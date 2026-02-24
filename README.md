# Cairn

Markdown-first knowledge base with MCP interface. Built for capturing meeting transcripts, building entity graphs, and maintaining structured notes — all through natural LLM interactions.

**Stack:** Cloudflare Workers, R2, Durable Objects (SQLite), Google OAuth, MCP (Model Context Protocol)

## Setup

### Prerequisites

- Node.js 18+
- A Google Cloud OAuth client (for authentication)
- Cloudflare account (for deployment)

### Local Development

```bash
# Install dependencies
npm install

# Create .dev.vars from the example
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your Google OAuth credentials:
#   GOOGLE_CLIENT_ID=your-client-id
#   GOOGLE_CLIENT_SECRET=your-client-secret
#   COOKIE_ENCRYPTION_KEY=generate-with-openssl-rand-hex-32
#   ADMIN_EMAIL=your@email.com

# Start local dev server
npm run dev
```

The dev server runs at `http://localhost:8788` with local R2, KV, and Durable Object emulation.

### Deployment

```bash
# Create R2 bucket
npx wrangler r2 bucket create cairn-storage

# Create KV namespace for OAuth token storage
npx wrangler kv namespace create cairn-oauth-kv
# Update wrangler.jsonc with the returned KV namespace ID

# Set secrets
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put COOKIE_ENCRYPTION_KEY
npx wrangler secret put ADMIN_EMAIL

# Deploy
npx wrangler deploy
```

Google Cloud OAuth client config:
- Authorized redirect URI: `https://cairn.<your-subdomain>.workers.dev/callback`
- Scopes: `openid email profile`

## MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "cairn": {
      "url": "https://cairn.<your-subdomain>.workers.dev/<workspace-id>/mcp"
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "cairn": {
      "url": "https://cairn.<your-subdomain>.workers.dev/<workspace-id>/mcp"
    }
  }
}
```

Replace `<workspace-id>` with your workspace slug (e.g. `bright_falcon`).

## MCP Tools

| Tool | Description |
|------|-------------|
| `cairn_read` | Read a note's content, optionally just a section or metadata |
| `cairn_write` | Create or overwrite a note (upsert) |
| `cairn_patch` | Append, prepend, or replace within a note |
| `cairn_delete` | Delete a note and its index entries |
| `cairn_search` | Full-text + metadata search with snippets |
| `cairn_links` | Get backlink graph around a note |
| `cairn_daily` | Daily note operations with auto-creation |
| `cairn_list` | List notes with path prefix filtering and pagination |

See [MCP Spec](./docs/mcp-spec.md) for full tool schemas and examples.

## Admin Frontend

Visit `https://cairn.<your-subdomain>.workers.dev/` to access the admin UI:
- Sign in with Google
- Create and manage workspaces
- Invite members by email
- Configure workspace settings (timezone, entity types)
- Rebuild search indexes

## Architecture

- **R2** stores note content (markdown + YAML frontmatter) and workspace metadata
- **WorkspaceIndex DO** (Durable Object with SQLite) maintains all indexes: backlinks, search terms, aliases, note metadata
- **CairnMCP** (McpAgent) handles MCP tool calls, reads/writes R2 directly, sends lightweight metadata to WorkspaceIndex
- **workers-oauth-provider** handles Google OAuth for both MCP clients and browser frontend

## API Routes

```
GET  /                                  # Admin frontend SPA
POST /:workspaceId/mcp                  # MCP endpoint (streamable HTTP)

GET  /api/workspaces                    # List user's workspaces
POST /api/workspaces                    # Create workspace
GET  /api/workspaces/:id                # Workspace details
PUT  /api/workspaces/:id                # Update workspace settings
DELETE /api/workspaces/:id              # Delete workspace (admin only)

GET  /api/workspaces/:id/members        # List members
POST /api/workspaces/:id/members        # Invite member
DELETE /api/workspaces/:id/members/:email  # Remove member

POST /api/workspaces/:id/rebuild-index  # Rebuild WorkspaceIndex
```

## Documentation

- [Requirements](./docs/requirements.md) — what we're building and why
- [Architecture](./docs/architecture.md) — system design and component details
- [MCP Spec](./docs/mcp-spec.md) — tool definitions and schemas
- [Implementation Plan](./docs/implementation-plan.md) — sequenced build plan
