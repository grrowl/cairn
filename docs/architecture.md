# Cairn — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                Cloudflare Worker                  │   │
│  │                                                   │   │
│  │  ┌───────────────┐   ┌────────────────────────┐  │   │
│  │  │ OAuthProvider  │   │      Router            │  │   │
│  │  │ (workers-oauth │   │  /authorize,/callback  │  │   │
│  │  │  -provider)    │   │  /api/*                │  │   │
│  │  └───────┬────────┘   │  /:workspaceId/mcp     │  │   │
│  │          │            │  / (frontend)           │  │   │
│  │          │            └──────────┬─────────────┘  │   │
│  │          │                       │                │   │
│  │          │            ┌──────────▼─────────────┐  │   │
│  │          │            │  Auth Middleware        │  │   │
│  │          │            │  (validate token,      │  │   │
│  │          │            │   check membership)    │  │   │
│  │          │            └──────────┬─────────────┘  │   │
│  │          │                       │                │   │
│  │  ┌───────▼────────┐  ┌──────────▼─────────────┐  │   │
│  │  │  Google OAuth   │  │   Tool / API Layer     │  │   │
│  │  │  Handler        │  │   (workspace-scoped)   │  │   │
│  │  └────────────────┘  └──────────┬─────────────┘  │   │
│  │                                  │                │   │
│  └──────────────────────────────────┼────────────────┘   │
│                                     │                     │
│          ┌──────────────────────────┼─────────────┐      │
│          │                          │              │      │
│          ▼                          ▼              │      │
│  ┌───────────────┐  ┌──────────────────────────┐  │      │
│  │   R2 Bucket    │  │  WorkspaceIndex DO       │  │      │
│  │                │  │  (one per workspace)     │  │      │
│  │ {ws}/notes/*   │  │                          │  │      │
│  │ _system/*      │  │  SQLite tables:          │  │      │
│  │                │  │  - notes (metadata)      │  │      │
│  │ (note content  │  │  - links (backlinks)     │  │      │
│  │  + workspace   │  │  - aliases               │  │      │
│  │  metadata)     │  │  - search_terms          │  │      │
│  └───────────────┘  └──────────────────────────┘  │      │
│          ▲                          ▲              │      │
│          │       rebuildIndex()     │              │      │
│          └──────────────────────────┘              │      │
│                                                    │      │
│  ┌─────────────────────────────────────────────┐  │      │
│  │              KV (OAUTH_KV)                   │  │      │
│  │  OAuth token storage (managed by             │  │      │
│  │  workers-oauth-provider)                     │  │      │
│  └─────────────────────────────────────────────┘  │      │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │
         │ OAuth 2.0 (user authentication)
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
/.well-known/*                  → OAuth metadata (auto by workers-oauth-provider)
/authorize, /callback, /token   → OAuth flow (auto by workers-oauth-provider)
/                               → Frontend SPA
/api/workspaces/*               → Workspace management REST API
/{workspaceId}/mcp              → MCP server (POST, streamable HTTP)
```

Routing is path-based. The `/{workspaceId}/mcp` pattern is matched **after** OAuth and static routes. Workspace IDs cannot collide with reserved paths: `auth`, `api`, `authorize`, `callback`, `token`, `.well-known`.

The worker is wrapped in `OAuthProvider` from `workers-oauth-provider`, which intercepts OAuth-related paths before they reach our router.

### 2. Auth Layer

**How `workers-oauth-provider` works:**

The library wraps the entire worker and implements OAuth 2.1 provider semantics. It handles three roles:

1. **OAuth server to MCP clients** — issues access tokens to Claude, Cursor, etc.
2. **OAuth client to Google** — authenticates users via Google accounts
3. **Token manager** — stores/validates tokens in KV

We provide a Google OAuth handler that implements the authorize/callback flow with Google. The library handles everything else: token issuance, refresh, validation, the `/.well-known/oauth-authorization-server` metadata endpoint.

**MCP client flow:**
1. Client discovers OAuth metadata at `/.well-known/oauth-authorization-server`
2. Client redirects user to `/authorize` with PKCE
3. Worker redirects to Google
4. Google redirects to `/callback`
5. Worker validates Google tokens, extracts user identity
6. Worker redirects back to MCP client with authorization code
7. Client exchanges code for access token at `/token`
8. Client uses bearer token on all subsequent MCP requests

**Browser frontend flow:**
The admin SPA uses the same OAuth flow. It acts as an OAuth client to the worker, receiving a bearer token that it stores in memory and includes on REST API calls. No separate session/cookie mechanism.

**Workspace authorization (every MCP + API request):**
1. `workers-oauth-provider` validates the bearer token and provides user identity
2. Our middleware extracts `workspaceId` from the URL
3. Reads workspace metadata from R2 (`_system/workspaces/{workspaceId}.json`)
4. Checks user email against `members` list or `ADMIN_EMAIL` env var
5. Rejects with appropriate error if unauthorized

**Secrets (wrangler secrets / env vars):**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `COOKIE_ENCRYPTION_KEY` — used by `workers-oauth-provider` for cookie encryption
- `ADMIN_EMAIL` — platform admin email

**KV namespace:**
- `OAUTH_KV` — used by `workers-oauth-provider` for token storage. We don't interact with this directly.

### 3. MCP Server (CairnMCP)

Uses `McpAgent` from `agents/mcp` (Cloudflare Agents SDK) with `McpServer` from `@modelcontextprotocol/sdk`.

`CairnMCP` extends `McpAgent<Env, State, Props>` where `Props` includes the authenticated user's email and the workspace ID. Tools are registered in `init()` and have access to:

- `this.env.BUCKET` — R2 bucket for direct note I/O
- `this.env.WORKSPACE_INDEX` — DO namespace for index operations
- `this.props` — `{ email, workspaceId }` from auth context

Each incoming MCP request goes through auth middleware, which populates props before the agent handles the request.

The MCP server is stateless between requests — all persistent state lives in R2 (notes) and the WorkspaceIndex DO (indexes).

### 4. Storage Layer

#### Notes (R2 — direct from worker)

Notes are stored as individual R2 objects:
- Key: `{workspaceId}/notes/{path}.md`
- Content-Type: `text/markdown`
- Custom metadata: `title`, `type`, `tags` (comma-separated), `modified`

Read/write operations go **directly to R2 from the worker**. This keeps reads fast (~5-20ms from edge). The worker parses frontmatter and extracts wikilinks locally, then sends lightweight metadata to the WorkspaceIndex DO.

Custom metadata is updated on **every** write path — both `cairn_write` (full overwrite) and `cairn_patch` (read-modify-write). This ensures `cairn_list` can return accurate metadata without reading object bodies.

#### System data (R2)

Workspace and user metadata are stored as JSON in R2:
- `_system/workspaces/{workspaceId}.json` — workspace config + member list
- `_system/users/{email}.json` — list of workspace memberships (for fast "my workspaces" lookup)

#### Indexes (WorkspaceIndex Durable Object — SQLite)

All indexes live in the WorkspaceIndex DO's embedded SQLite storage. **No index data is stored in R2.** This eliminates the concurrent JSON clobber problem entirely.

One DO instance per workspace, keyed by workspace ID.

**SQLite schema:**

```sql
CREATE TABLE notes (
  path TEXT PRIMARY KEY,
  title TEXT,
  type TEXT,
  tags TEXT,         -- JSON array e.g. '["co-founder","ceo"]'
  aliases TEXT,      -- JSON array e.g. '["Jamie","JW"]'
  created TEXT,
  modified TEXT
);

CREATE TABLE links (
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  context TEXT,
  PRIMARY KEY (source_path, target_path)
);

CREATE TABLE aliases (
  alias TEXT PRIMARY KEY,   -- normalised: lowercase, trimmed
  canonical_path TEXT NOT NULL
);

CREATE TABLE search_terms (
  term TEXT NOT NULL,
  path TEXT NOT NULL,
  PRIMARY KEY (term, path)
);
```

**Data flow on note write/patch:**

```
Worker                                    WorkspaceIndex DO
  │                                              │
  │  1. Parse markdown (frontmatter, body)       │
  │  2. Extract [[wikilinks]] from body          │
  │  3. Write note to R2 directly                │
  │                                              │
  │  4. RPC: noteUpdated(path, {                 │
  │       title, type, tags, aliases,  ──────►   │
  │       links: [{target, context}],            │
  │       modified                               │
  │     })                                       │
  │                                              │
  │                              5. Diff links vs existing │
  │                              6. Update all SQLite tables│
  │                              7. Return confirmation     │
  │  ◄──────────────────────────────────────────────────── │
  │                                              │
  │  8. Return success to MCP client             │
```

**Key design constraint:** File content never crosses the DO RPC boundary during normal operations. The worker extracts metadata locally and sends only structured data to the DO.

The DO reads R2 directly (`this.env.BUCKET`) only during `rebuildIndex()` — an admin-triggered operation that scans all notes and repopulates the SQLite tables from scratch.

**Index update on noteUpdated:**
1. Read existing metadata and links for this path from SQLite
2. Delete old entries: search terms, outgoing links, old aliases
3. Insert new entries: metadata row, search terms (tokenized), outgoing links, aliases
4. Update incoming backlinks on target notes (based on link diff)
5. Return confirmation

### 5. Workspace Management

REST API for CRUD on workspaces and members. Used by the frontend.

Workspace metadata lives at `_system/workspaces/{id}.json` in R2. User records at `_system/users/{email}.json` contain a list of workspace memberships for fast lookup.

Workspace IDs are auto-generated as `{adjective}_{noun}` (e.g. `bright_falcon`) using randomised word lists, or user-provided custom slugs. Validated against reserved route names.

### 6. Frontend

Single HTML file served from the worker at `/`. No build step, no framework — vanilla JS with minimal CSS.

Auth uses the same OAuth flow as MCP clients — the SPA initiates `/authorize`, receives a bearer token, stores it in memory, and uses it for API calls.

Pages (client-side routing via hash):
- `#/login` — Google sign-in button
- `#/workspaces` — list + create workspaces
- `#/workspaces/:id` — settings, member management
- `#/workspaces/:id/notes` — (stretch) tree view + markdown preview

## Scaling Considerations

This architecture is designed for personal/small-team use (1-10 users, <10k notes). Known limits and upgrade paths:

| Concern | MVP Approach | Scale Path |
|---------|-------------|------------|
| Search | Simple inverted index in DO SQLite | SQLite FTS5 (if supported), or D1 |
| Backlinks | DO SQLite per workspace | D1 table for cross-workspace queries |
| Concurrency | One DO per workspace serialises index writes | Shard by path prefix if contention grows |
| Index size | Full SQLite DB in DO | Monitor DO storage limits (~10GB), migrate to D1 |
| Auth | OAuth bearer tokens in memory | Add API key support for headless MCP clients |
| R2 list | Paginated (1000/call) | If >10k notes, add path index to DO SQLite |

## Deployment

```bash
# Create R2 bucket
npx wrangler r2 bucket create cairn-storage

# Create KV namespace (for OAuth token storage)
npx wrangler kv namespace create cairn-oauth-kv

# Set secrets
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put COOKIE_ENCRYPTION_KEY
npx wrangler secret put ADMIN_EMAIL

# Deploy
npx wrangler deploy

# Local dev
npx wrangler dev
```

The `wrangler.jsonc` binds:
- R2 bucket as `BUCKET`
- Durable Object namespace `WORKSPACE_INDEX` (WorkspaceIndex class)
- Durable Object namespace `MCP_OBJECT` (CairnMCP class, from template)
- KV namespace `OAUTH_KV` (for OAuth token storage)

Google Cloud OAuth client config:
- Authorized redirect URI: `https://cairn.<subdomain>.workers.dev/callback`
- Scopes: `openid email profile`
