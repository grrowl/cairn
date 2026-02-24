# Cairn — Implementation Plan (Claude Code Handover)

## Context

Cairn is a markdown-first knowledge base with an MCP interface, built on Cloudflare Workers. It's designed for capturing meeting transcripts, building entity graphs via backlinks, and maintaining structured notes — all through LLM tool calls.

Read the full requirements in `docs/requirements.md`, architecture in `docs/architecture.md`, and MCP tool spec in `docs/mcp-spec.md`.

## Bootstrap

Start from Cloudflare's official Google OAuth MCP template:

```bash
npm create cloudflare@latest -- cairn-template --template=cloudflare/ai/demos/remote-mcp-google-oauth
```

This scaffolds into a `cairn-template/` directory. Then merge the generated files into the existing project directory:

```bash
# From the parent directory of both cairn/ and cairn-template/
cp -r cairn-template/* cairn/
cp cairn-template/.* cairn/ 2>/dev/null  # hidden files like .gitignore
rm -rf cairn-template
cd cairn
npm install
```

The `docs/` folder already exists in `cairn/` — don't overwrite it. If any file conflicts (e.g. README.md), keep the generated version and update it.

This gives us: McpAgent class, Durable Objects, Google OAuth via `workers-oauth-provider`, KV-backed token storage, streamable HTTP transport at `/mcp`, wrangler config with DO + KV bindings.

We build on top of this, keeping its auth plumbing intact and adding R2 storage, workspace scoping, cairn tools, and a minimal admin frontend.

## Key Design Principles

Before starting implementation, internalise these:

1. **R2 for content, DO SQLite for indexes.** Notes live in R2. All metadata, backlinks, search terms, and aliases live in the WorkspaceIndex Durable Object's SQLite storage. No JSON index files in R2.

2. **Lightweight RPC.** The worker reads/writes R2 directly. It sends only extracted metadata (title, tags, aliases, links, modified) to the WorkspaceIndex DO — never full file content.

3. **Workspace-scoped from day one.** All storage functions take `workspaceId` as a parameter from Phase 1. In early phases, auto-create a `"default"` workspace. No hardcoded workspace that needs refactoring later.

4. **MCP-native errors.** All tool errors use `{ content: [{ type: "text", text: "error_type: message" }], isError: true }`.

5. **Paginate everything.** `cairn_list` and `cairn_search` support cursor-based pagination from day one. R2 list returns max 1000 objects per call.

6. **Don't rewrite the OAuth plumbing.** The template's `workers-oauth-provider` setup handles auth for both MCP clients and the browser frontend. Adapt, don't replace.

## Sequenced Implementation Phases

### Phase 0: Scaffold & Verify Baseline

**Goal:** Template running locally with Google OAuth flow working.

1. Bootstrap and merge as described above
2. Rename the McpAgent class from `MyMCP` to `CairnMCP`
3. Update wrangler.jsonc:
   - Add R2 bucket binding: `BUCKET` → `cairn-storage`
   - Add a second Durable Object class `WorkspaceIndex`:
     - Add to `durable_objects.bindings`: `{ "class_name": "WorkspaceIndex", "name": "WORKSPACE_INDEX" }`
     - Add to `migrations`: new migration tag (e.g. `"v2"`) with `"new_sqlite_classes": ["WorkspaceIndex"]`
     - **Export `WorkspaceIndex` from the worker entrypoint** (alongside `CairnMCP`)
   - Keep existing KV namespace for OAuth token storage (`OAUTH_KV`)
   - Add `ADMIN_EMAIL` to secrets
4. Create a stub `WorkspaceIndex` class that extends `DurableObject` with a `ping()` method
5. Strip the demo tools (add, generateImage, etc.) from `init()`, replace with:
   - `cairn_ping` — returns `{ status: "ok", timestamp: "..." }` to confirm MCP pipeline
6. Verify: `npm run dev` → connect via MCP Inspector → Google OAuth flow completes → `cairn_ping` works → R2 binding accessible

**Key files to understand from the template:**
- `src/index.ts` — worker entrypoint, OAuthProvider wrapper, McpAgent export
- Google OAuth handler file — the authorize/callback flow with Google
- `wrangler.jsonc` — bindings config

**Understand how the template passes user identity to the McpAgent.** The `Props` type parameter on `McpAgent<Env, State, Props>` contains auth context. The template's OAuth handler populates this. Our tools will access `this.props` to get the authenticated user's email.

### Phase 1: Storage Layer + WorkspaceIndex DO

**Goal:** Read and write markdown notes to R2, with WorkspaceIndex DO maintaining metadata in SQLite.

#### R2 Note Operations

Create `src/storage/notes.ts` — workspace-scoped R2 abstraction:

- `readNote(bucket, workspaceId, path)` → returns `{ frontmatter, body, raw }` or null
- `writeNote(bucket, workspaceId, path, content, frontmatterOverrides?)` → writes `{workspaceId}/notes/{path}.md` to R2 with custom metadata
- `deleteNote(bucket, workspaceId, path)` → deletes the R2 object
- `patchNote(bucket, workspaceId, path, op, content, section?, find?)` → read-modify-write for append/prepend/replace/section ops

All functions take `workspaceId` as an explicit parameter. No hardcoded defaults.

`writeNote` and `patchNote` both:
- Set `modified` timestamp server-side
- Set `created` only on first write (check if object exists)
- Update R2 custom metadata: `title`, `type`, `tags` (comma-separated), `modified`
- Return extracted metadata for passing to WorkspaceIndex: `{ title, type, tags, aliases, modified }`

#### Frontmatter

Create `src/storage/frontmatter.ts`:
- `parseFrontmatter(raw)` → `{ frontmatter: Record<string, any>, body: string }`
- `serialiseFrontmatter(frontmatter, body)` → raw markdown string with YAML frontmatter
- Use `js-yaml` if it works in Workers. If not, hand-roll a parser — our frontmatter is just key-value pairs, arrays, and ISO dates.

#### Markdown Sections

Create `src/storage/markdown.ts`:
- `extractSection(body, headingText)` → content under that heading (until next heading of same/higher level)
- `appendToSection(body, headingText, content)` → insert at end of section
- `prependToSection(body, headingText, content)` → insert after heading line

Section matching: find the first line matching `/^#{1,6}\s+{headingText}\s*$/i`. The `headingText` parameter does **not** include the `#` prefix. Match is case-insensitive.

These are pure string operations on markdown, no AST needed.

#### WorkspaceIndex DO (SQLite)

Create `src/storage/workspace-index.ts`:

```typescript
export class WorkspaceIndex extends DurableObject {
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initTables();
  }

  private initTables() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        path TEXT PRIMARY KEY,
        title TEXT,
        type TEXT,
        tags TEXT,
        aliases TEXT,
        created TEXT,
        modified TEXT
      );
      CREATE TABLE IF NOT EXISTS links (
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        context TEXT,
        PRIMARY KEY (source_path, target_path)
      );
      CREATE TABLE IF NOT EXISTS aliases (
        alias TEXT PRIMARY KEY,
        canonical_path TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS search_terms (
        term TEXT NOT NULL,
        path TEXT NOT NULL,
        PRIMARY KEY (term, path)
      );
    `);
  }

  async noteUpdated(path: string, metadata: NoteMetadata): Promise<void> { ... }
  async noteDeleted(path: string): Promise<void> { ... }
  async search(params: SearchParams): Promise<SearchResult> { ... }
  async listNotes(params: ListParams): Promise<ListResult> { ... }
  async getLinks(path: string, depth: number, direction: string): Promise<LinkResult> { ... }
  async resolveAlias(alias: string): Promise<string | null> { ... }
  async rebuildIndex(): Promise<{ notes_indexed: number }> { ... }
}
```

For Phase 1, implement:
- `initTables()` — create SQLite tables
- `noteUpdated()` — upsert into `notes` table, update `search_terms` (simple word tokenisation), update `aliases`
- `noteDeleted()` — remove from all tables
- `listNotes()` — query `notes` table with optional prefix filter, sort, limit, cursor

Defer `search()`, `getLinks()`, `resolveAlias()`, and `rebuildIndex()` to later phases (return empty results / not-implemented for now).

**Tokenisation** for `search_terms`: lowercase, split on whitespace + punctuation, remove tokens < 3 chars. No stemming.

#### Verify

Write notes via `cairn_ping` (temporarily extended) or a test script against local R2. Confirm:
- Note written to R2 at correct key
- Frontmatter parsed correctly
- R2 custom metadata set
- WorkspaceIndex DO receives `noteUpdated()` and SQLite tables populated

### Phase 2: Core MCP Tools (Read, Write, List, Daily)

**Goal:** The four most-used tools working end-to-end.

Auto-create a `"default"` workspace on first request if it doesn't exist (check `_system/workspaces/default.json` in R2). The workspace ID comes from the URL path — `/{workspaceId}/mcp`. All tools read `workspaceId` from `this.props`.

Register tools in `CairnMCP.init()`:

**`cairn_read`**
- Calls `readNote()` from R2
- If `section` provided: extract section from body
- If `metadata_only: true`: return frontmatter only (backlinks from WorkspaceIndex deferred to Phase 4)
- Return as MCP text content block (raw markdown with frontmatter)

**`cairn_write`**
- Parse incoming content for frontmatter
- Merge explicit `tags`/`aliases` params with frontmatter from content
- Call `writeNote()` to R2
- Extract wikilinks from body (simple regex: `/\[\[([^\]]+)\]\]/g` — full parser in Phase 4)
- Call `WorkspaceIndex.noteUpdated()` with extracted metadata
- Return success with path and whether note was created

**`cairn_list`**
- Call `WorkspaceIndex.listNotes()` with params from tool input
- Return paths, titles, types, modified dates
- Include `cursor` in response if more results available

**`cairn_daily`**
- Construct path: `daily/{date}` where date defaults to today in workspace timezone
- If note doesn't exist: create with frontmatter only (title=date, type=daily, tags=[daily])
- `read` → delegate to `cairn_read`
- `append`, `append_section`, `prepend_section` → delegate to `cairn_patch` (Phase 3 — for now, only `read` works)

Tool input schemas: use `zod` (already in template dependencies) to define schemas matching `docs/mcp-spec.md`.

**Verify:** Connect via MCP Inspector or Claude → create a daily note → write an entity note → read them back → list notes.

### Phase 3: Patch, Delete, Search

**Goal:** Complete the tool set.

**`cairn_patch`**
- Call `patchNote()` — reads from R2, applies operation, writes back
- Operations: `append`, `prepend`, `replace`, `append_section`, `prepend_section`
- Validation: `replace` requires `find`; section ops require `section`; `find` must match exactly once
- After write: update R2 custom metadata, call `WorkspaceIndex.noteUpdated()` with re-extracted metadata and wikilinks
- This is the workhorse for incremental knowledge building

**`cairn_delete`**
- Delete R2 object
- Call `WorkspaceIndex.noteDeleted()`
- Returns success with deleted path

**`cairn_search`**
- Validate: at least one of `query`, `tags`, `path_prefix`, `backlinks_to`, `modified_since` required
- Call `WorkspaceIndex.search()` which queries SQLite:
  - `query` → match against `search_terms` table, return matching paths
  - `tags` → filter `notes` table where tags JSON contains all specified tags
  - `path_prefix` → `WHERE path LIKE '{prefix}%'`
  - `modified_since` → `WHERE modified > '{date}'`
  - `backlinks_to` → `WHERE target_path = '{path}'` in `links` table
  - Combine filters with AND
- Return snippets: for each result, read first 200 chars of note body from R2 (or use the search context if from backlinks)
- Support cursor-based pagination

**Update `cairn_daily`** to support all ops (now that `cairn_patch` exists).

**Verify:** Patch a daily note with meeting content → delete a test note → search by keyword → search by tag → verify pagination.

### Phase 4: Backlinks, Aliases & Link Graph

**Goal:** Full wikilink resolution, bidirectional backlinks, `cairn_links` tool.

**WikiLink Parser** — `src/storage/wikilinks.ts`:
- `extractLinks(body)` → returns `[{ raw: "[[Jamie Wilson]]", target: "jamie-wilson", display: "Jamie Wilson" }]`
- Handle aliased links: `[[Jamie Wilson|Jamie]]` → target: `"jamie-wilson"`, display: `"Jamie"`
- Handle path links: `[[daily/2026-02-24]]` → target: `"daily/2026-02-24"`
- Normalise targets to lowercase slugs (replace spaces with hyphens, strip special chars)

**Update `WorkspaceIndex.noteUpdated()`:**
- Accept `links` array: `[{ target, context }]` where context is ~50 chars around the link
- Diff against existing outgoing links in `links` table
- Update `links` table (add new, remove old)
- For each link target, attempt alias resolution from `aliases` table

**Update `WorkspaceIndex.noteUpdated()` for aliases:**
- When note has `aliases` in metadata, update `aliases` table
- Delete old aliases for this path, insert new ones (normalised lowercase)

**Implement `WorkspaceIndex.resolveAlias()`:**
- Query `aliases` table, return canonical path or null

**Implement `WorkspaceIndex.getLinks()`:**
- Query `links` table for incoming (`WHERE target_path = ?`) and outgoing (`WHERE source_path = ?`)
- Support `depth > 1` via recursive queries (or iterative BFS up to max depth 3)
- Join with `notes` table for titles
- Return structure only, no content

**`cairn_links` tool:**
- Call `WorkspaceIndex.getLinks()` with path, depth, direction
- Return incoming/outgoing arrays with path, title, context

**Update `cairn_read` (metadata_only):**
- When `metadata_only: true`, also query `WorkspaceIndex.getLinks()` for backlink list
- Include in frontmatter output

**Update `cairn_write` and `cairn_patch`:**
- Use the full wikilink parser (replacing the simple regex from Phase 2)
- Pass extracted links with context to `WorkspaceIndex.noteUpdated()`

**Verify:** Write notes with `[[wikilinks]]` → confirm backlinks in index → query link graph → verify alias resolution → `cairn_read` with `metadata_only` shows backlinks.

### Phase 5: Workspace Management & Multi-Tenancy

**Goal:** Full workspace lifecycle, membership checks, REST API.

**Workspace ID Generation:**
- Use `unique-names-generator` (or implement a simple version): pick random adjective + noun from curated word lists using `crypto.getRandomValues()`
- Format: `{adjective}_{noun}` e.g. `bright_falcon`
- Also accept custom slugs from user
- Validate: 3-40 chars, lowercase alphanumeric + hyphens + underscores, not starting with `_`, not colliding with reserved routes

**Workspace CRUD** (`src/workspaces/routes.ts`):
```
GET  /api/workspaces              — list workspaces for current user
POST /api/workspaces              — create workspace (auto-generate ID or accept custom slug)
GET  /api/workspaces/:id          — workspace details
PUT  /api/workspaces/:id          — update workspace settings
DELETE /api/workspaces/:id        — delete workspace (admin only)
```

**Member Management:**
```
GET    /api/workspaces/:id/members        — list members
POST   /api/workspaces/:id/members        — invite member (by email)
DELETE /api/workspaces/:id/members/:email — remove member
```

**User Records** (`_system/users/{email}.json`):
```json
{
  "email": "tom@example.com",
  "name": "Tom",
  "workspaces": ["brainwaves", "personal"],
  "updated_at": "2026-02-24T00:00:00Z"
}
```

Updated when workspace membership changes. Used for fast "list my workspaces" lookup.

**Membership Middleware** (`src/workspaces/membership.ts`):
- On every MCP and API request that includes a workspace ID:
  - Read workspace metadata from R2
  - Check user email in members list OR matches `ADMIN_EMAIL`
  - Reject with MCP error / HTTP 403 if neither
  - Attach workspace context to request

**Admin Endpoint:**
```
POST /api/workspaces/:id/rebuild-index — triggers WorkspaceIndex.rebuildIndex()
```

**Implement `WorkspaceIndex.rebuildIndex()`:**
- List all R2 objects under `{workspaceId}/notes/`
- For each: read note, parse frontmatter, extract wikilinks
- Clear all SQLite tables
- Repopulate from scratch
- Return `{ notes_indexed: N }`
- The DO accesses R2 via `this.env.BUCKET`

**Remove auto-create "default" workspace.** Now that we have proper workspace creation, require explicit creation.

**Verify:** Create workspace via API → invite member → confirm MCP tools scoped correctly → non-members rejected → rebuild index works.

### Phase 6: Admin Frontend

**Goal:** Minimal web UI for workspace and member management.

**Single HTML file** served from the worker at `/` — no build step, no framework:
- Inline JS + CSS
- Client-side routing via hash fragments
- Auth: uses the same OAuth flow — SPA initiates `/authorize`, stores bearer token in memory, uses it for API calls

**Pages:**
- `#/login` — Google sign-in button (redirects to `/authorize`)
- `#/workspaces` — list workspaces, create new (with auto-generated or custom ID)
- `#/workspaces/:id` — settings, member list, invite by email, remove member, rebuild index button
- `#/workspaces/:id/notes` — (stretch) simple tree view of notes with markdown preview

**Styling:** Minimal, clean. Dark theme. Think Obsidian's settings panel, not a full note editor. We're managing access, not editing notes — that's what the MCP tools are for.

**Verify:** Sign in → create workspace → invite member → see workspace list → rebuild index from UI.

### Phase 7: Polish & Hardening

**Goal:** Production readiness.

1. **Search quality:** Review tokenisation. Consider adding bigrams or prefix matching for better search results. If DO SQLite supports FTS5, evaluate migrating `search_terms` to an FTS5 virtual table.

2. **Rebuild index robustness:** Handle large workspaces (pagination of R2 list, batch SQLite inserts). Add progress reporting.

3. **Error handling audit:** Ensure all R2 failures, DO communication errors, and edge cases return proper MCP errors. No unhandled promise rejections.

4. **Rate limiting:** Basic rate limiting on REST API endpoints (workspace creation, member invites) to prevent abuse.

5. **Logging:** Structured logging for debugging. Use `console.log` with JSON payloads. Cloudflare's observability (already enabled in wrangler.jsonc) captures these.

6. **Documentation:** Update README with setup instructions, usage examples, MCP client config snippets for Claude/Cursor.

## Key Technical Decisions

### Workers-OAuth-Provider Library

The template uses `workers-oauth-provider` which implements OAuth 2.1 provider semantics. The worker acts as BOTH an OAuth client to Google AND an OAuth server to MCP clients. This means:
- MCP clients (Claude, Cursor, etc.) authenticate to our worker using MCP's standard OAuth flow
- Our worker then authenticates the user with Google behind the scenes
- The worker issues its own tokens to MCP clients
- The admin frontend uses the same OAuth flow, storing the bearer token in memory
- This is the correct pattern per the MCP spec — don't try to shortcut it

### Secrets

Use standard wrangler secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `COOKIE_ENCRYPTION_KEY`, `ADMIN_EMAIL`. The template also uses KV (`OAUTH_KV`) for OAuth token storage — this is separate from secrets and managed automatically.

### R2 Object Key Schema (Simplified)

```
{workspaceId}/notes/{path}.md          — note content (markdown + YAML frontmatter)
_system/workspaces/{workspaceId}.json  — workspace metadata + members
_system/users/{email}.json             — user workspace memberships
```

No index files in R2. All indexes live in WorkspaceIndex DO SQLite.

### Durable Object Strategy

Two DO classes exported from the worker:

- `CairnMCP` (extends McpAgent) — handles MCP sessions, one instance per client connection
- `WorkspaceIndex` (extends DurableObject) — maintains all indexes in SQLite, one instance per workspace (keyed by workspaceId)

The worker gets a WorkspaceIndex stub via:
```typescript
const id = this.env.WORKSPACE_INDEX.idFromName(workspaceId);
const index = this.env.WORKSPACE_INDEX.get(id);
await index.noteUpdated(path, metadata);
```

### R2 ↔ DO Data Flow

**Critical:** File content never crosses the DO RPC boundary during normal operations. The pattern is:

| Operation | Worker does | DO receives |
|-----------|------------|-------------|
| Write/Patch | Parse frontmatter, extract wikilinks, write to R2 | `noteUpdated(path, { title, type, tags, aliases, links, modified })` |
| Delete | Delete from R2 | `noteDeleted(path)` |
| Search | Receives results, optionally reads R2 for snippets | `search(params)` → returns `{ path, title, snippet?, tags, modified }[]` |
| List | — | `listNotes(params)` → returns `{ path, title, type, modified }[]` |
| Links | — | `getLinks(path, depth, direction)` → returns `{ incoming[], outgoing[] }` |
| Rebuild | — | DO reads R2 directly via `this.env.BUCKET` |

### Section Convention

All tools use heading text **without** `#` prefix. Example: `"Meetings"` not `"## Meetings"`. Matches first heading with that text, case-insensitive, regardless of level.

### Daily Notes

Path: `daily/YYYY-MM-DD`. Timezone from workspace settings (default `Australia/Melbourne`). Created with frontmatter only (no template content). Content added via `cairn_patch` or `cairn_daily` append ops.

## File Structure (Target)

```
cairn/
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   ├── mcp-spec.md
│   └── implementation-plan.md    ← this file
├── src/
│   ├── index.ts                  ← worker entrypoint, OAuthProvider, exports CairnMCP + WorkspaceIndex
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
│   │   └── workspace-index.ts    ← WorkspaceIndex Durable Object (SQLite)
│   ├── workspaces/
│   │   ├── routes.ts             ← REST API for workspace management
│   │   ├── membership.ts         ← membership check middleware
│   │   ├── id-generator.ts       ← adjective_noun workspace ID generation
│   │   └── types.ts
│   ├── auth/
│   │   └── middleware.ts         ← token validation, user context extraction
│   └── frontend/
│       └── index.html            ← admin SPA
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

## Order of Operations for Claude Code

1. Run the bootstrap and merge steps, verify template works with `npm run dev`
2. **Read the generated template code thoroughly before changing anything** — understand how OAuthProvider wraps the worker, how props flow to McpAgent, how DO bindings work
3. Follow phases 0→7 in sequence — each phase should result in testable functionality
4. After each phase, verify with MCP Inspector before moving on
5. Keep the OAuth plumbing from the template as-is — adapt, don't rewrite
6. When adding R2 operations, test locally first (wrangler dev provides local R2 emulation)
7. All storage functions take `workspaceId` from Phase 1 — no refactoring needed when multi-tenancy arrives
8. For the frontend (Phase 6), keep it dead simple — single HTML file, no build step
9. When in doubt about DO communication, remember: send metadata not content over RPC

## Testing Strategy

- **MCP Inspector** (`npx @modelcontextprotocol/inspector`) for tool-level testing
- **wrangler dev** for local development with R2/KV/DO emulation
- **curl** for REST API endpoints (workspace management)
- **Browser** for OAuth flow and frontend testing
- Manual smoke test: create workspace → write daily note → add entity with aliases → patch daily note → verify backlinks → search → rebuild index

## Deployment

```bash
# Create R2 bucket
npx wrangler r2 bucket create cairn-storage

# Create KV namespace (for OAuth token storage)
npx wrangler kv namespace create cairn-oauth-kv
# Update wrangler.jsonc with the returned KV namespace ID

# Set secrets
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put COOKIE_ENCRYPTION_KEY  # generate with: openssl rand -hex 32
npx wrangler secret put ADMIN_EMAIL

# Deploy
npx wrangler deploy
```

Google Cloud OAuth client config:
- Authorized redirect URI: `https://cairn.<subdomain>.workers.dev/callback`
- Scopes: `openid email profile`
