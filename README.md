# Cairn

Markdown-first knowledge base with MCP interface. Built for capturing meeting transcripts, building entity graphs, and maintaining structured notes — all through natural LLM interactions.

**Stack:** Cloudflare Workers, R2, Durable Objects (SQLite), Google OAuth, MCP (Model Context Protocol)

## Getting Started

```bash
# Bootstrap from Cloudflare's Google OAuth MCP template into a temp directory
npm create cloudflare@latest -- cairn-template --template=cloudflare/ai/demos/remote-mcp-google-oauth

# Merge generated files into this project (don't overwrite docs/)
cp -r cairn-template/* .
cp cairn-template/.* . 2>/dev/null
rm -rf cairn-template
npm install
```

Then follow `docs/implementation-plan.md` for the sequenced build plan.

## Architecture

- **R2** stores note content (markdown + YAML frontmatter) and workspace metadata
- **WorkspaceIndex DO** (Durable Object with SQLite) maintains all indexes: backlinks, search terms, aliases, note metadata
- **CairnMCP** (McpAgent) handles MCP tool calls, reads/writes R2 directly, sends lightweight metadata to WorkspaceIndex
- **workers-oauth-provider** handles Google OAuth for both MCP clients and browser frontend

## Documentation

- [Requirements](./docs/requirements.md) — what we're building and why
- [Architecture](./docs/architecture.md) — system design and component details
- [MCP Spec](./docs/mcp-spec.md) — tool definitions and schemas
- [Implementation Plan](./docs/implementation-plan.md) — sequenced build plan for Claude Code handover
