# Cairn — Requirements

## Overview

Cairn is a remote-first, markdown-based knowledge management system designed for LLM-native workflows. Its primary interface is MCP (Model Context Protocol), enabling AI assistants to read, write, and cross-reference notes on behalf of users.

The core use case is ingesting meeting transcripts and call recordings, extracting entities (people, companies, decisions), linking them to daily notes, and building a navigable knowledge graph over time.

## Tenancy Model

### Workspaces

A **workspace** is the top-level isolation boundary. All notes, backlinks, and metadata are scoped to a workspace.

- Each workspace has a unique `workspaceId` (slug)
- R2 storage is prefixed: `{workspaceId}/notes/...`
- MCP endpoint is scoped: `/{workspaceId}/mcp`
- A user can belong to multiple workspaces

### Workspace IDs

Workspace IDs are URL-safe slugs. They can be:

- **Auto-generated:** `{adjective}_{noun}` format (e.g. `bright_falcon`, `calm_river`). Selected randomly from curated word lists using `crypto.getRandomValues()`. Use `unique-names-generator` or equivalent.
- **Custom:** User-provided slug on creation.

Validation rules:
- Lowercase alphanumeric + hyphens + underscores
- 3–40 characters
- Cannot start with `_` (reserved for `_system` prefix)
- Cannot collide with reserved routes: `auth`, `api`, `mcp`, `authorize`, `callback`, `token`
- Must be unique across all workspaces

### Roles

| Role | Capabilities |
|------|-------------|
| **admin** | Full access to all workspaces. Can create/delete workspaces, manage members. Platform-level role. |
| **owner** | Full access within their workspace. Can invite/remove members, manage workspace settings. |
| **member** | Read/write notes within their workspace. Cannot manage members or settings. |

Tom (platform admin) has visibility across all workspaces via the `ADMIN_EMAIL` env var.

### Workspace Metadata

Stored in R2 at `_system/workspaces/{workspaceId}.json`:

```json
{
  "id": "brainwaves",
  "name": "Brainwaves",
  "created_at": "2026-02-24T00:00:00Z",
  "created_by": "tom@example.com",
  "members": [
    { "email": "tom@example.com", "role": "owner", "added_at": "..." },
    { "email": "jamie@example.com", "role": "member", "added_at": "..." }
  ],
  "settings": {
    "entity_types": ["person", "company", "project", "topic"],
    "timezone": "Australia/Melbourne"
  }
}
```

Note: there is no `daily_note_template` setting. Daily notes use a well-known path convention (`daily/YYYY-MM-DD`) and are created empty (frontmatter only) when they don't exist. Users can populate them via `cairn_patch`.

## Authentication

### Overview

Cairn uses `workers-oauth-provider` — the library acts as both:

1. **OAuth server** to MCP clients — issues access tokens per the MCP spec
2. **OAuth client** to Google — authenticates users via their Google accounts

This is the standard pattern for remote MCP servers. Do not shortcut this — MCP clients expect the full OAuth 2.1 flow.

### MCP Client Auth Flow

1. MCP client (Claude, Cursor, etc.) discovers OAuth metadata at `/.well-known/oauth-authorization-server`
2. Client redirects user to `/authorize`
3. Worker redirects to Google OAuth
4. Google redirects back to `/callback`
5. Worker creates a session, redirects to MCP client's `redirect_uri` with auth code
6. MCP client exchanges code for access token at `/token`
7. MCP client includes token as `Authorization: Bearer` on all MCP requests

Token storage is in KV (`OAUTH_KV` binding). This is handled automatically by `workers-oauth-provider`.

### Browser (Frontend) Auth

The admin frontend uses the **same OAuth flow**. The SPA acts as an OAuth client to the worker:

1. SPA redirects to `/authorize` with a well-known client ID (e.g. `cairn-admin`)
2. Standard Google OAuth flow completes
3. Worker issues a token, which the SPA stores in memory
4. SPA includes the token as `Authorization: Bearer` on REST API calls

This keeps one auth flow for both MCP clients and the browser. No separate cookie/session mechanism.

### Workspace Membership Check

On each MCP request, after token validation:

1. Resolve user email from the token
2. Read workspace metadata from R2
3. Check if user's email is in the `members` list, OR matches `ADMIN_EMAIL`
4. Reject with MCP error if unauthorized

### Secrets

Stored via `wrangler secret put` (env vars):

| Secret | Purpose |
|--------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `COOKIE_ENCRYPTION_KEY` | Encryption key for OAuth cookies (used by `workers-oauth-provider`) |
| `ADMIN_EMAIL` | Platform admin email (bypasses workspace membership checks) |

The template also uses KV (`OAUTH_KV`) for OAuth token storage. This is separate from secrets.

## Storage Layer

### R2 Object Key Schema

```
{workspaceId}/notes/{path}.md          # note content (markdown + YAML frontmatter)
_system/workspaces/{workspaceId}.json  # workspace metadata + members
_system/users/{email}.json             # user profile + workspace memberships
```

Indexes (backlinks, search, aliases) are **not** stored in R2. They live in the WorkspaceIndex Durable Object's SQLite storage.

### Note Format

Notes are stored as markdown with YAML frontmatter:

```markdown
---
title: Jamie Wilson
type: person
tags: [co-founder, ceo]
aliases: [Jamie, JW]
created: 2026-02-24T10:30:00Z
modified: 2026-02-24T14:00:00Z
---

# Jamie Wilson

CEO and co-founder of Brainwaves.

## Meeting Notes

- [[daily/2026-02-24]]: Discussed V2.1 launch timeline
```

R2 custom metadata on each object: `title`, `tags` (comma-separated), `type`, `modified`. This allows `cairn_list` to return metadata without reading object bodies.

**Important:** Custom metadata must be updated on every write path — both `cairn_write` and `cairn_patch`.

### Daily Notes

Daily notes use the path `daily/YYYY-MM-DD` (e.g. `daily/2026-02-24`). The date is determined by the workspace's configured timezone (default: `Australia/Melbourne`).

When `cairn_daily` is called and the note doesn't exist, it is created with frontmatter only:

```markdown
---
title: "2026-02-24"
type: daily
tags: [daily]
created: 2026-02-24T00:00:00+11:00
modified: 2026-02-24T00:00:00+11:00
---
```

No default template content. Content is added via subsequent `cairn_patch` or `cairn_daily` append calls.

### WikiLinks

Notes use `[[wikilink]]` syntax to reference other notes:

- `[[Jamie Wilson]]` — normalised to a slug and resolved via alias index
- `[[Jamie Wilson|Jamie]]` — aliased link (display text after `|`)
- `[[daily/2026-02-24]]` — direct path reference

Link resolution: when a link like `[[Jamie]]` is written, the WorkspaceIndex DO checks its alias table. If `"jamie"` maps to `entities/person/jamie-wilson`, the backlink is recorded against that canonical path. If no alias matches, the link is stored as-is (normalised to a slug).

### WorkspaceIndex (Durable Object with SQLite)

Each workspace has a **WorkspaceIndex** Durable Object that maintains all indexes in its embedded SQLite storage:

**SQLite Tables:**

```sql
-- Note metadata cache
CREATE TABLE notes (
  path TEXT PRIMARY KEY,
  title TEXT,
  type TEXT,
  tags TEXT,         -- JSON array
  aliases TEXT,      -- JSON array
  created TEXT,      -- ISO datetime
  modified TEXT      -- ISO datetime
);

-- Bidirectional links
CREATE TABLE links (
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  context TEXT,      -- snippet of surrounding text
  PRIMARY KEY (source_path, target_path)
);

-- Alias resolution
CREATE TABLE aliases (
  alias TEXT PRIMARY KEY,   -- normalised lowercase
  canonical_path TEXT NOT NULL
);

-- Inverted search index
CREATE TABLE search_terms (
  term TEXT NOT NULL,
  path TEXT NOT NULL,
  PRIMARY KEY (term, path)
);
```

**RPC interface** (called from worker via `this.env.WORKSPACE_INDEX.get(id)`):

| Method | Called when | Payload (lightweight) |
|--------|-----------|----------------------|
| `noteUpdated(path, metadata)` | After write or patch | `{ title, type, tags, aliases, links[], modified }` |
| `noteDeleted(path)` | After delete | Just the path |
| `search(params)` | `cairn_search` | Query params, returns paths + snippets |
| `listNotes(params)` | `cairn_list` | Prefix/sort/limit/cursor, returns metadata |
| `getLinks(path, depth, direction)` | `cairn_links` | Path + traversal params |
| `resolveAlias(alias)` | Link resolution during write | Normalised alias string |
| `rebuildIndex()` | Admin endpoint | No payload; DO reads all notes from R2 via `this.env.BUCKET` |

**Key design principle:** File content never crosses the RPC boundary during normal operations. The worker reads/writes R2 directly, extracts metadata (frontmatter, wikilinks), and passes only the extracted metadata to the DO. The DO only reads R2 during `rebuildIndex()`.

### Concurrency

- Note writes go directly to R2 (last-write-wins for the file itself)
- Index updates are serialised by the WorkspaceIndex DO (one per workspace)
- The DO's SQLite storage handles concurrent index mutations atomically
- For personal/small-team use (1-10 users, <10k notes), this is sufficient

## MCP Server

### Transport

Cloudflare's MCP server template with **Streamable HTTP transport** at `/{workspaceId}/mcp`.

### Tools

See [mcp-spec.md](./mcp-spec.md) for full tool definitions.

Summary:
- `cairn_read` — read note content, optionally just a section or metadata
- `cairn_write` — create/overwrite a note (upsert)
- `cairn_patch` — append, prepend, or replace within a note (also updates index)
- `cairn_delete` — delete a note, optionally clean up backlinks
- `cairn_search` — full-text + metadata search, returns snippets
- `cairn_links` — get backlink graph around a note
- `cairn_daily` — shortcut for daily note operations
- `cairn_list` — list notes in a path prefix

### Error Handling

All errors use **MCP's native error mechanism** (`isError: true` in tool results). Standard error types:

- `not_found` — note doesn't exist
- `unauthorized` — not a member of this workspace
- `validation_error` — bad params (missing required fields, invalid ops)
- `conflict` — ambiguous match (e.g. `replace` op found multiple matches for `find`)

Example error response:
```json
{
  "content": [{ "type": "text", "text": "not_found: Note 'entities/person/nobody' does not exist" }],
  "isError": true
}
```

## Frontend

Minimal admin SPA served from the worker at `/`.

### Pages

1. **Login** — Google OAuth sign-in (initiates OAuth flow via `/authorize`)
2. **Workspaces** — list workspaces you belong to, create new ones
3. **Workspace Settings** — member management (invite by email, remove, change role)
4. **Note Browser** (stretch) — simple tree view + markdown preview of workspace contents

### Tech

- Single HTML file with inline JS/CSS (served from worker, no build step)
- Auth via bearer token from OAuth flow (stored in memory, not cookie)
- Calls workspace management API endpoints

## API Routes

```
GET  /                                  # frontend SPA
/.well-known/oauth-authorization-server # OAuth metadata (auto by workers-oauth-provider)
GET  /authorize                         # OAuth authorize endpoint
GET  /callback                          # OAuth callback from Google
POST /token                             # OAuth token exchange

GET  /api/workspaces                    # list user's workspaces
POST /api/workspaces                    # create workspace
GET  /api/workspaces/:id                # workspace details
PUT  /api/workspaces/:id                # update workspace settings
DELETE /api/workspaces/:id              # delete workspace (admin only)

GET  /api/workspaces/:id/members        # list members
POST /api/workspaces/:id/members        # invite member
DELETE /api/workspaces/:id/members/:email  # remove member

POST /api/workspaces/:id/rebuild-index  # rebuild WorkspaceIndex from R2 (admin only)

POST /:workspaceId/mcp                  # MCP endpoint (streamable HTTP)
```

OAuth paths (`/authorize`, `/callback`, `/token`, `/.well-known/*`) are handled by `workers-oauth-provider` at root level. Workspace IDs in URLs cannot collide with these reserved paths.

## Non-Functional Requirements

- **Latency**: MCP tool calls should complete in <200ms for reads, <500ms for writes (index update included)
- **Storage**: No hard limits for MVP, but note size capped at 1MB
- **Availability**: Cloudflare Workers SLA, R2 durability
- **Cost**: Should run comfortably within Cloudflare free/pro tier for personal use
- **Pagination**: `cairn_list` and `cairn_search` support cursor-based pagination from day one. R2 list returns max 1000 objects per call; all list operations must handle this.

## Future / Out of Scope for V1

- Real-time collaboration / CRDT sync
- Obsidian vault sync (CLI or plugin)
- Vectorize-powered semantic search
- File attachments (images, PDFs)
- Note versioning / history
- Webhook notifications on note changes
- Public sharing of individual notes
- SQLite FTS5 for full-text search (upgrade path from simple inverted index)
