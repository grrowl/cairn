# Cairn — Implementation Plan (Claude Code Handover)

## Context

Cairn is a markdown-first knowledge base with an MCP interface, built on Cloudflare Workers. It's designed for capturing meeting transcripts, building entity graphs via backlinks, and maintaining structured notes — all through LLM tool calls.

Read the full requirements in `docs/requirements.md`, architecture in `docs/architecture.md`, and MCP tool spec in `docs/mcp-spec.md`.

## Bootstrap

Start from Cloudflare's official Google OAuth MCP template:

```bash
npm create cloudflare@latest -- cairn --template=cloudflare/ai/demos/remote-mcp-google-oauth
```

This gives us: McpAgent class, Durable Objects, Google OAuth via `workers-oauth-provider`, KV-backed token storage, streamable HTTP transport at `/mcp`, wrangler config with DO + KV bindings.

We build on top of this, keeping its auth plumbing intact and adding R2 storage, workspace scoping, cairn tools, and a minimal admin frontend.

## Sequenced Implementation Phases

### Phase 0: Scaffold & Verify Baseline

**Goal:** Template running locally with Google OAuth flow working.

1. Bootstrap from template as above
2. Rename the McpAgent class from `MyMCP` to `CairnMCP`
3. Update wrangler.jsonc:
   - Add R2 bucket binding: `BUCKET` → `cairn-storage`
   - Add a second Durable Object class `IndexWriter` for backlink/search index serialisation (new_sqlite_classes migration)
   - Keep existing KV namespace for OAuth token storage (`OAUTH_KV`)
   - Add `ADMIN_EMAIL` secret (used later for admin access)
4. Verify: `npm run dev` → connect via MCP Inspector → Google OAuth flow completes → demo tools accessible
5. Strip the demo tools (add, generateImage, etc.) from `init()`, replace with a single `cairn_ping` tool that returns `{ status: "ok", workspace: "default" }` to confirm the pipeline works

**Key files to understand from the template:**
- `src/index.ts` — worker entrypoint, OAuthProvider wrapper, McpAgent export
- `src/google-handler.ts` (or similar) — the Google OAuth authorize/callback flow
- `wrangler.jsonc` — bindings config

### Phase 1: Storage Layer (R2 Notes CRUD)

**Goal:** Read and write markdown notes to R2 with frontmatter parsing.

1. Create `src/storage/notes.ts` — a workspace-scoped R2 abstraction:
   - `readNote(bucket, workspaceId, path)` → returns `{ frontmatter, body, raw }` or null
   - `writeNote(bucket, workspaceId, path, content, metadata?)` → writes `{workspaceId}/notes/{path}.md` to R2 with custom metadata (title, tags, modified)
   - `deleteNote(bucket, workspaceId, path)` → deletes the object
   - `listNotes(bucket, workspaceId, prefix?, limit?)` → R2 list with prefix `{workspaceId}/notes/{prefix}`
   - `patchNote(bucket, workspaceId, path, op, content, section?, find?)` → read-modify-write for append/prepend/replace/section ops

2. Create `src/storage/frontmatter.ts` — YAML frontmatter parser/serialiser:
   - `parseFrontmatter(raw)` → `{ frontmatter: Record<string, any>, body: string }`
   - `serialiseFrontmatter(frontmatter, body)` → raw markdown string
   - Use a lightweight YAML parser (js-yaml or hand-roll for the simple subset we need — Workers runtime constraints apply)

3. Create `src/storage/markdown.ts` — section extraction and manipulation:
   - `extractSection(body, heading)` → returns the content under that heading (until next heading of same/higher level)
   - `appendToSection(body, heading, content)` → inserts content at end of section
   - `prependToSection(body, heading, content)` → inserts content at start of section
   - These are pure string operations on markdown, no AST needed

4. Verify: Write a simple test script or use the cairn_ping tool to exercise read/write/list against R2 locally (wrangler dev provides local R2)

**Dependencies:** `js-yaml` (or similar, check Workers compatibility) for frontmatter parsing. If problematic, write a simple parser — our frontmatter is just key-value pairs, arrays, and dates.

### Phase 2: Core MCP Tools (Read, Write, List, Daily)

**Goal:** The four most-used tools working end-to-end.

For now, hardcode workspace to `"default"` — we'll add workspace routing in Phase 4.

1. Register tools in `CairnMCP.init()`:

   **`cairn_read`** — calls `readNote()`, optionally extracts section, optionally returns metadata_only (frontmatter + placeholder backlinks array)

   **`cairn_write`** — calls `writeNote()`, merges explicit tags/aliases params with any frontmatter in content, sets `created`/`modified` timestamps

   **`cairn_list`** — calls `listNotes()`, returns paths + titles + modified dates (pulled from R2 custom metadata for efficiency — avoid reading full objects)

   **`cairn_daily`** — sugar: constructs path as `daily/YYYY-MM-DD` (default today, respect timezone from request or default UTC+11 for Melbourne), creates note from template if it doesn't exist, delegates to read/patch operations

2. Tool input schemas: use `zod` (already in template dependencies) to define schemas matching `docs/mcp-spec.md`

3. Tool responses: return MCP text content blocks. Keep responses compact — the LLM is the consumer.

4. Verify: Connect via MCP Inspector or Claude, create a daily note, write an entity note, read them back, list notes.

### Phase 3: Patch, Delete, Search

**Goal:** Complete the remaining tools.

1. **`cairn_patch`** — calls `patchNote()`. This is the workhorse for incremental knowledge building. Operations: append, prepend, replace, append_section, prepend_section. `replace` op requires `find` param, fails if substring not found or ambiguous (appears more than once).

2. **`cairn_delete`** — calls `deleteNote()`. For now, skip the `remove_backlinks` cleanup (implement in Phase 5 with backlink index). Just delete the R2 object.

3. **`cairn_search`** — MVP implementation: R2 list + filter. List all notes under workspace prefix, read custom metadata (title, tags) for filtering. For `query` param, do a simple substring match against note content (read full objects — this is expensive but fine for <1000 notes). Return snippets (first 200 chars of matching content). Later (Phase 5) we replace this with an index.

4. Verify: Patch a daily note with meeting content, delete a test note, search for keywords.

### Phase 4: Workspace Scoping & Multi-Tenancy

**Goal:** MCP endpoint scoped per workspace, basic workspace management.

1. **URL routing:** Change the MCP endpoint from `/mcp` to `/:workspaceId/mcp`. This requires modifying the worker's fetch handler to:
   - Extract `workspaceId` from the URL path
   - Pass it through to the McpAgent (via props or context)
   - The CairnMCP agent reads `workspaceId` from its props and uses it to scope all R2 operations

   **Important:** The OAuthProvider wrapper from the template intercepts requests at specific paths (`/authorize`, `/callback`, `/token`, etc.). We need to ensure workspace-scoped MCP paths don't collide with these. The OAuth paths should remain at the root level.

2. **Workspace metadata:** Store workspace config at `_system/workspaces/{id}.json` in R2:
   ```json
   {
     "id": "brainwaves",
     "name": "Brainwaves",
     "created_at": "...",
     "created_by": "tom@example.com",
     "members": [
       { "email": "tom@example.com", "role": "owner" },
       { "email": "jamie@example.com", "role": "member" }
     ],
     "settings": {
       "daily_note_template": "## Meetings\n\n## Decisions\n\n## Notes\n",
       "entity_types": ["person", "company", "project", "topic"],
       "timezone": "Australia/Melbourne"
     }
   }
   ```

3. **Membership check:** On each MCP request, after OAuth validation:
   - Read workspace metadata from R2
   - Check if the authenticated user's email is in the members list
   - OR if the user's email matches `ADMIN_EMAIL` (admin override)
   - Reject with `unauthorized` if neither

4. **User records:** Store at `_system/users/{email}.json` — list of workspace memberships for fast lookup. Updated when workspace membership changes.

5. **Workspace REST API** (minimal, for the admin frontend):
   ```
   GET  /api/workspaces              — list workspaces for current user
   POST /api/workspaces              — create workspace
   GET  /api/workspaces/:id          — workspace details
   POST /api/workspaces/:id/members  — invite member (by email)
   DELETE /api/workspaces/:id/members/:email — remove member
   ```
   These routes are handled by the worker's fetch handler, authenticated via the same OAuth session. Add these routes alongside the OAuthProvider handler.

6. Verify: Create two workspaces, add a member to one, confirm MCP tools are scoped correctly, confirm non-members are rejected.

### Phase 5: Backlink Index & Link Graph

**Goal:** Bidirectional backlinks working, `cairn_links` tool, alias resolution.

1. **Wiki-link parser** — `src/storage/wikilinks.ts`:
   - `extractLinks(body)` → returns array of `{ raw: "[[Jamie Wilson]]", target: "jamie-wilson" }` (normalised to path-friendly slug)
   - Handle aliased links: `[[Jamie Wilson|Jamie]]` syntax

2. **Alias index** — stored at `{workspaceId}/index/aliases.json`:
   - Map of `alias → canonical path` e.g. `{ "jamie": "entities/person/jamie-wilson", "jw": "entities/person/jamie-wilson" }`
   - Updated on `cairn_write` when note has `aliases` in frontmatter
   - Used during link resolution: `[[Jamie]]` → lookup alias → resolve to `entities/person/jamie-wilson`

3. **Backlink index** — stored at `{workspaceId}/index/backlinks.json`:
   - Map of `path → { incoming: [{ from, context }], outgoing: [path] }`
   - Updated on every write/patch/delete

4. **IndexWriter Durable Object** — serialises index mutations:
   - Receives messages: `{ op: "update_links", workspaceId, path, oldLinks, newLinks, aliases }`
   - Reads current index from R2, applies diff, writes back
   - Keyed by workspaceId so each workspace has its own DO instance

5. **`cairn_links` tool** — reads backlink index, returns incoming/outgoing for a path at given depth. No content, just structure.

6. **Update `cairn_read`** — when `metadata_only: true`, include actual backlinks from the index.

7. **Update `cairn_delete`** — when `remove_backlinks: true` (default), send cleanup message to IndexWriter to remove references from other notes' outgoing links.

8. **Update `cairn_search`** — add `backlinks_to` param that reads from the backlink index instead of scanning notes.

9. Verify: Write notes with `[[wikilinks]]`, confirm backlinks indexed, query link graph, verify alias resolution.

### Phase 6: Admin Frontend

**Goal:** Minimal web UI for workspace and member management.

1. **Single HTML file** served from the worker at `/` — no build step, no framework:
   - Inline JS + CSS
   - Client-side routing via hash fragments
   - Auth: uses the same session cookie from Google OAuth

2. **Pages:**
   - `#/login` — Google sign-in button (redirects to `/authorize`)
   - `#/workspaces` — list workspaces, create new
   - `#/workspaces/:id` — settings, member list, invite by email, remove member
   - `#/workspaces/:id/notes` — (stretch) simple tree view of notes with markdown preview

3. **Styling:** Minimal, clean. Dark theme. Think Obsidian's settings panel, not a full note editor. We're managing access, not editing notes — that's what the MCP tools are for.

4. Verify: Sign in, create workspace, invite a member, see workspace list.

### Phase 7: Search Index (Upgrade)

**Goal:** Replace the brute-force search from Phase 3 with an inverted index.

1. **Search index** — stored at `{workspaceId}/index/search.json`:
   - Inverted index: `term → [path, ...]`
   - Metadata cache: `path → { title, tags, modified }`
   - Updated via IndexWriter DO alongside backlink updates

2. **Tokenisation:** Simple word-level tokenisation, lowercase, strip punctuation. No stemming for MVP.

3. **Update `cairn_search`** to use the index for `query` param. Fall back to metadata cache for `tags` and `modified_since` filters.

4. **Index size management:** For workspaces with many notes, the single JSON blob will get large. Add a check: if index exceeds ~1MB, log a warning. Migration path is D1 or Vectorize (out of scope).

5. Verify: Write 50+ notes, search by keyword, confirm results are fast and accurate.

## Key Technical Decisions

### Workers-OAuth-Provider Library
The template uses `workers-oauth-provider` which implements OAuth 2.1 provider semantics. The worker acts as BOTH an OAuth client to Google AND an OAuth server to MCP clients. This means:
- MCP clients (Claude, Cursor, etc.) authenticate to our worker using MCP's standard OAuth flow
- Our worker then authenticates the user with Google behind the scenes
- The worker issues its own tokens to MCP clients
- This is the correct pattern per the MCP spec — don't try to shortcut it

### Secrets in Env Vars (Not KV)
For now, use standard wrangler secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `COOKIE_ENCRYPTION_KEY`, `ADMIN_EMAIL`). The KV secrets pattern from the community fork adds complexity we don't need for a single-server deployment. If we later need to share secrets across multiple workers, we can layer it in.

### R2 Object Key Schema
```
{workspaceId}/notes/{path}.md          — note content
{workspaceId}/index/backlinks.json     — backlink index
{workspaceId}/index/search.json        — search index
{workspaceId}/index/aliases.json       — alias → path mapping
_system/workspaces/{workspaceId}.json  — workspace metadata
_system/users/{email}.json             — user workspace memberships
```

### Durable Object Strategy
Two DO classes:
- `CairnMCP` (from McpAgent) — handles MCP sessions, one instance per client connection
- `IndexWriter` — serialises index mutations, one instance per workspace (keyed by workspaceId)

### Frontmatter Approach
Notes use YAML frontmatter. The `modified` timestamp is always set server-side on write/patch. `created` is set only on first write. Tags and aliases in frontmatter are the source of truth, but can also be set via tool params (merged on write).

### Daily Note Timezone
Default to `Australia/Melbourne` (UTC+11). Configurable per workspace in settings. The `cairn_daily` tool uses this to determine "today".

## File Structure (Target)

```
cairn/
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   ├── mcp-spec.md
│   └── implementation-plan.md    ← this file
├── src/
│   ├── index.ts                  ← worker entrypoint, router, OAuthProvider
│   ├── google-handler.ts         ← Google OAuth flow (from template, adapted)
│   ├── mcp/
│   │   ├── agent.ts              ← CairnMCP class extending McpAgent
│   │   └── tools/
│   │       ├── read.ts
│   │       ├── write.ts
│   │       ├── patch.ts
│   │       ├── delete.ts
│   │       ├── search.ts
│   │       ├── links.ts
│   │       ├── daily.ts
│   │       └── list.ts
│   ├── storage/
│   │   ├── notes.ts              ← R2 CRUD operations
│   │   ├── frontmatter.ts        ← YAML frontmatter parse/serialise
│   │   ├── markdown.ts           ← section extraction/manipulation
│   │   ├── wikilinks.ts          ← [[link]] parser + alias resolution
│   │   └── index-writer.ts       ← IndexWriter Durable Object
│   ├── workspaces/
│   │   ├── routes.ts             ← REST API for workspace management
│   │   ├── membership.ts         ← membership check middleware
│   │   └── types.ts
│   ├── auth/
│   │   └── middleware.ts         ← session validation, user context extraction
│   └── frontend/
│       └── index.html            ← admin SPA
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

## Order of Operations for Claude Code

1. Run the bootstrap command, verify it works with `npm run dev`
2. Read the generated template code thoroughly before changing anything
3. Follow phases 0→7 in sequence — each phase should result in testable functionality
4. After each phase, verify with MCP Inspector before moving on
5. Keep the OAuth plumbing from the template as-is — adapt, don't rewrite
6. When adding R2 operations, test locally first (wrangler dev provides local R2 emulation)
7. For the frontend (Phase 6), keep it dead simple — single HTML file, no build step

## Testing Strategy

- **MCP Inspector** (`npx @modelcontextprotocol/inspector`) for tool-level testing
- **wrangler dev** for local development with R2/KV/DO emulation
- **curl** for REST API endpoints (workspace management)
- **Browser** for OAuth flow and frontend testing
- Manual smoke test: create workspace → write daily note → add entity with aliases → verify backlinks → search

## Deployment

```bash
# Create R2 bucket
npx wrangler r2 bucket create cairn-storage

# Create KV namespace (for OAuth)
npx wrangler kv namespace create cairn-oauth-kv

# Set secrets
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put COOKIE_ENCRYPTION_KEY
npx wrangler secret put ADMIN_EMAIL

# Deploy
npx wrangler deploy
```

Remember to create a Google Cloud OAuth client with:
- Authorized redirect URI: `https://cairn.<subdomain>.workers.dev/callback`
- Scopes: `openid email profile`
