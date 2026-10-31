# cairn

**Shared graph knowledge vault for your agents.**

Obsidian-like structured, back-linked markdown notes — accessible to all your AI agents via [MCP](https://modelcontextprotocol.io). WikiLinks, backlinks, daily notes, full-text search, and a sensible minimal tool interface designed to be a shareable knowledge vault across Claude, Cursor, and any MCP client.

**Try it now at [cairn.chillidonut.com](https://cairn.chillidonut.com)**

<!-- screenshot or demo gif here -->

## How it works

1. **Sign in** at [cairn.chillidonut.com](https://cairn.chillidonut.com) and create a workspace
2. **Connect your agents** — add the MCP endpoint to Claude Desktop, Cursor, Claude Code, or any MCP client
3. **Your agents share a brain** — notes, entities, meeting logs, and project context persist across conversations and tools

```json
{
  "mcpServers": {
    "cairn": {
      "url": "https://cairn.chillidonut.com/<workspace-id>/mcp"
    }
  }
}
```

**Want to try it first?** Use the `default` workspace — it's a shared sandbox open to any authenticated user, no invite needed:

```json
{
  "mcpServers": {
    "cairn": {
      "url": "https://cairn.chillidonut.com/mcp"
    }
  }
}
```

## MCP Tools

A minimal, focused interface — 8 tools that cover everything an agent needs:

| Tool | Description |
|------|-------------|
| `cairn_read` | Read a note, a specific section, or just metadata |
| `cairn_write` | Create or overwrite a note with frontmatter, tags, and aliases |
| `cairn_list` | List notes with path prefix filtering, sorting, and pagination |
| `cairn_search` | Full-text + tag + backlink search with snippets |
| `cairn_daily` | Read or append to today's daily note (auto-created) |
| `cairn_patch` | Append, prepend, or find-and-replace within an existing note |
| `cairn_delete` | Delete a note and clean up its index entries |
| `cairn_links` | Traverse the backlink graph around a note |

Notes are markdown with YAML frontmatter. WikiLinks (`[[target]]`) are automatically indexed for backlink traversal and alias resolution.

See [MCP Spec](./docs/mcp-spec.md) for full tool schemas.

## Features

- **WikiLinks & backlinks** — `[[link]]` syntax with automatic graph indexing and alias resolution
- **Daily notes** — timezone-aware daily journal with append/prepend operations
- **Full-text search** — inverted index with prefix matching, tag filtering, and backlink queries
- **Workspaces** — isolated vaults with member management and role-based access
- **Admin UI** — browse your vault, view files with syntax-highlighted markdown, manage members and settings

## Self-hosting

Cairn runs on Cloudflare Workers with R2, KV, and Durable Objects. See the [Architecture docs](./docs/architecture.md) for details.

```bash
npm ci                  # Node.js 24+
cp .dev.vars.example .dev.vars  # add Google OAuth credentials
npm run dev                      # http://localhost:8788
```

See [deployment instructions](#deployment) for production setup.

## Architecture

- **R2** — note content (markdown + YAML frontmatter) and workspace metadata
- **Durable Objects (SQLite)** — backlinks, search terms, aliases, note metadata indexes
- **MCP (stateless SDK v2)** — supports MCP 2026-07-28 and legacy 2025 clients; reads/writes R2 directly and sends metadata to indexes
- **OAuth 2.1 + Google OIDC** — S256 PKCE, verified Google identity, CIMD and dynamic client registration for MCP clients and the browser UI

## Checks

`npm run check` runs TypeScript and the isolated Worker/browser integration tests.
Tests exercise modern discovery, legacy MCP, token refresh from the original OAuth library,
consent CSRF/replay protection, browser PKCE, and workspace data isolation.

## Deployment

```bash
npx wrangler r2 bucket create cairn-storage
npx wrangler kv namespace create cairn-oauth-kv
# Update wrangler.jsonc with the KV namespace ID

npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put COOKIE_ENCRYPTION_KEY
npx wrangler secret put ADMIN_EMAIL

npx wrangler deploy
```

Google Cloud OAuth client config:
- Authorized redirect URI: `https://your-domain/callback`
- Scopes: `openid email profile`

## Documentation

- [Requirements](./docs/requirements.md) — what we're building and why
- [Architecture](./docs/architecture.md) — system design and component details
- [MCP Spec](./docs/mcp-spec.md) — tool definitions and schemas

---

Built by [@grrowl](https://github.com/grrowl) ([tommckenzie.dev](https://tommckenzie.dev))
