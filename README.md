# Cairn

Markdown-first knowledge base with MCP interface. Built for capturing meeting transcripts, building entity graphs, and maintaining structured notes — all through natural LLM interactions.

**Stack:** Cloudflare Workers, R2, Google OAuth, MCP (Model Context Protocol)

## Getting Started

```bash
# Bootstrap from Cloudflare's Google OAuth MCP template
npm create cloudflare@latest -- cairn --template=cloudflare/ai/demos/remote-mcp-google-oauth

# Then copy the docs/ folder into the generated project
# and follow docs/implementation-plan.md
```

## Documentation

- [Requirements](./docs/requirements.md) — what we're building and why
- [Architecture](./docs/architecture.md) — system design and component details
- [MCP Spec](./docs/mcp-spec.md) — tool definitions and schemas
- [Implementation Plan](./docs/implementation-plan.md) — sequenced build plan for Claude Code handover
