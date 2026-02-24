# Cairn — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Edge                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              Cloudflare Worker                │   │
│  │                                               │   │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │  Router  │→│   Auth    │→│  MCP Server │  │   │
│  │  │         │  │Middleware │  │  (per req)  │  │   │
│  │  └─────────┘  └──────────┘  └──────┬─────┘  │   │
│  │       │                            │         │   │
│  │       │        ┌───────────────────┘         │   │
│  │       │        │                             │   │
│  │  ┌────▼────┐  ┌▼──────────────┐              │   │
│  │  │Frontend │  │  Tool Layer   │              │   │
│  │  │  + API  │  │ (workspace    │              │   │
│  │  │ routes  │  │  scoped)      │              │   │
│  │  └─────────┘  └──────┬───────┘              │   │
│  │                       │                      │   │
│  └───────────────────────┼──────────────────────┘   │
│                          │                           │
│  ┌───────────────────────▼──────────────────────┐   │
│  │           Durable Object (IndexWriter)        │   │
│  │  Serialises backlink + search index writes    │   │
│  └───────────────────────┬──────────────────────┘   │
│                          │                           │
│  ┌───────────────────────▼──────────────────────┐   │
│  │                 R2 Bucket                      │   │
│  │  {workspace}/notes/...  (markdown files)      │   │
│  │  {workspace}/index/...  (backlink, search)    │   │
│  │  _system/...            (workspace metadata)  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
         │
         │ OAuth 2.0
         ▼
┌─────────────────┐
│  Google OAuth    │
│  (accounts.      │
│   google.com)    │
└─────────────────┘
```

## Component Details

### 1. Worker Entrypoint + Router

Single Cloudflare Worker handles all routes:

```
/                           → Frontend SPA
/auth/*                     → OAuth flow
/api/workspaces/*           → Workspace management REST API
/{workspaceId}/mcp          → MCP server (POST, streamable HTTP)
```

Routing is path-based. The `/{workspaceId}/mcp` pattern is matched after static routes, so workspace IDs cannot collide with `auth`, `api`, or static asset paths.

### 2. Auth Layer

**OAuth Flow:**
1. `GET /auth/login` → redirect to Google with `client_id`, `redirect_uri`, `scope`
2. Google redirects to `GET /auth/callback?code=...`
3. Worker exchanges code for tokens, extracts email from ID token
4. Creates/updates user record in `_system/users/{email}.json`
5. Sets signed JWT cookie (`__cairn_session`)
6. Redirects to `/`

**Session Validation (every request):**
1. Extract JWT from cookie or `Authorization: Bearer` header
2. Verify signature using `AUTH_SECRET` env var (HS256)
3. Check expiry
4. For MCP routes: resolve workspace from URL, check membership
5. Attach `{ email, name, role, workspaceId }` to request context

**Secrets (wrangler.toml / env vars):**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET` — signing key for JWTs
- `ADMIN_EMAIL` — platform admin email

### 3. MCP Server

Uses `@modelcontextprotocol/sdk` with Cloudflare's streamable HTTP transport adapter.

Each incoming MCP request:
1. Passes through auth middleware
2. Instantiates an MCP server scoped to `{ workspaceId, userEmail }`
3. Registers all `cairn_*` tools with workspace-scoped storage access
4. Handles the request and returns

The MCP server is stateless between requests — all state lives in R2.

### 4. Storage Layer

#### Notes (R2 direct)

Notes are stored as individual R2 objects:
- Key: `{workspaceId}/notes/{path}.md`
- Content-Type: `text/markdown`
- Custom metadata: `title`, `tags` (comma-sep), `modified`

Read/write operations go directly to R2. This keeps reads fast (~5-20ms from edge).

#### Indexes (via Durable Object)

Three indexes per workspace, stored as JSON objects in R2:

| Index | Key | Purpose |
|-------|-----|---------|
| Backlinks | `{ws}/index/backlinks.json` | `path → { incoming[], outgoing[] }` |
| Search | `{ws}/index/search.json` | `term → path[]` + metadata cache |
| Aliases | `{ws}/index/aliases.json` | `alias → canonical path` |

**Why a Durable Object?** R2 doesn't support conditional writes. Without coordination, concurrent note writes could clobber index state. The `IndexWriter` DO serialises all index mutations:

1. Tool handler writes the note to R2 directly (fast path)
2. Tool handler sends index update request to the DO
3. DO reads current index from R2, applies mutation, writes back
4. DO responds to tool handler with confirmation

The DO is keyed by workspace ID, so each workspace gets its own serialisation queue. This is fine for personal/small-team use. At scale, you'd shard by path prefix or move to D1.

#### Index Update Flow (on note write/patch)

```
1. Parse markdown for [[wikilinks]]
2. Resolve aliases to canonical paths
3. Diff against previous links (if updating existing note)
4. Send to IndexWriter DO:
   - Add/remove backlink entries
   - Update search terms (tokenise content)
   - Update metadata cache (title, tags, modified)
5. Return success to MCP client
```

### 5. Workspace Management

REST API for CRUD on workspaces and members. Used by the frontend.

Workspace metadata lives at `_system/workspaces/{id}.json` in R2. User records at `_system/users/{email}.json` contain a list of workspace memberships for fast lookup.

### 6. Frontend

Single HTML file served from the worker. No build step, no framework — vanilla JS with minimal CSS.

Pages (client-side routing via hash):
- `#/login` — Google sign-in button
- `#/workspaces` — list + create workspaces
- `#/workspaces/:id` — settings, member management
- `#/workspaces/:id/notes` — (stretch) tree view + markdown preview

## Scaling Considerations

This architecture is designed for personal/small-team use (1-10 users, <10k notes). Known limits and upgrade paths:

| Concern | MVP Approach | Scale Path |
|---------|-------------|------------|
| Search | In-memory inverted index in R2 JSON | D1 FTS or Vectorize |
| Backlinks | Single JSON per workspace | D1 table, or sharded JSON by first path segment |
| Concurrency | DO serialisation | DO per path prefix, or D1 with transactions |
| Index size | Full index loaded per DO operation | Chunked indexes, lazy loading |
| Auth | JWT in cookie | Add API key support for headless MCP clients |

## Deployment

```bash
# First time
npx wrangler r2 bucket create cairn-storage
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put AUTH_SECRET
npx wrangler secret put ADMIN_EMAIL

# Deploy
npx wrangler deploy

# Local dev
npx wrangler dev
```

The `wrangler.toml` binds:
- R2 bucket as `BUCKET`
- Durable Object namespace as `INDEX_WRITER`
