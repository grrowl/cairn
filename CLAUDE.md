# CLAUDE.md — Claude Code Handover

You are building **Cairn**, a markdown-first knowledge base with an MCP interface on Cloudflare Workers. This is a greenfield project with comprehensive specs already written.

## First Steps

1. **Read all four docs before writing any code:**
   - `docs/requirements.md` — what we're building
   - `docs/architecture.md` — system design, data flow, DO/R2 split
   - `docs/mcp-spec.md` — all 8 MCP tool definitions with schemas
   - `docs/implementation-plan.md` — sequenced build plan (this is your roadmap)

2. **Bootstrap the project** following the instructions in `docs/implementation-plan.md` → Bootstrap section. Scaffold the Cloudflare template into a temp directory, merge into this repo, install dependencies.

3. **Read the generated template code thoroughly** before making changes. Understand:
   - How `OAuthProvider` wraps the worker fetch handler
   - How `McpAgent<Env, State, Props>` receives auth context via `this.props`
   - How Durable Object bindings and migrations work in `wrangler.jsonc`
   - Where Google OAuth handler lives and how it populates user identity

4. **Follow the phases in `docs/implementation-plan.md` sequentially.** Phase 0 → Phase 7. Do not skip ahead.

## Methodology

### Per-Phase Discipline

Each phase must end with:

1. **Working verification** — the phase's stated verification steps pass. Use MCP Inspector (`npx @modelcontextprotocol/inspector`), `curl`, or browser as appropriate.
2. **Git commit** — clean commit with message like `phase 0: scaffold and verify baseline`. Commit working code only. If a phase is large, commit incrementally within it, but always leave the repo in a working state.
3. **No regressions** — before committing, verify that previous phases still work. Run `npm run dev` and confirm existing tools respond correctly.

### Testing Approach

- **`wrangler dev`** is your primary development environment. It emulates R2, KV, and Durable Objects locally.
- **MCP Inspector** (`npx @modelcontextprotocol/inspector`) is the primary tool testing interface. Connect to `http://localhost:8788/mcp` (or `http://localhost:8788/{workspaceId}/mcp` once workspace routing is added).
- **`curl`** for REST API endpoints.
- **Browser** for OAuth flow and frontend.
- Test the happy path AND error cases (missing notes, bad params, unauthorized access).
- If something isn't working, read the wrangler dev console output carefully — Durable Object errors and R2 failures show up there.

### Code Quality

- TypeScript strict mode. Define types for all data structures (frontmatter, tool params, DO RPC payloads).
- Keep files focused and small. One tool per file in `src/mcp/tools/`.
- Pure functions where possible (frontmatter parsing, markdown manipulation, wikilink extraction). These are easy to reason about and test.
- No external dependencies unless necessary. Check Workers runtime compatibility before adding anything. `js-yaml` and `zod` are fine. Avoid heavy packages.

### When You Hit a Problem

- **Template doesn't behave as expected:** Read the `workers-oauth-provider` source and Cloudflare Agents SDK docs. Don't guess at the API — check `node_modules/agents/` and `node_modules/workers-oauth-provider/` for type definitions.
- **DO communication issues:** Remember that Durable Object methods called via RPC must be `async` and return serialisable values. File content (large strings) should NOT cross the RPC boundary — extract metadata in the worker, send only structured data to the DO.
- **R2 quirks:** R2 custom metadata values must be strings. `tags` should be comma-separated, not JSON. `list()` returns max 1000 objects — always handle the `truncated` flag and `cursor` for pagination.
- **OAuth flow not completing:** The OAuth paths (`/authorize`, `/callback`, `/token`, `/.well-known/oauth-authorization-server`) are handled by the `OAuthProvider` wrapper BEFORE your router sees the request. Don't try to handle them yourself.

### Critical Design Constraints

These are non-negotiable. Do not deviate:

1. **R2 for content, DO SQLite for indexes.** Notes go in R2. All metadata, backlinks, search terms, and aliases go in WorkspaceIndex DO's SQLite. No JSON index files in R2.

2. **Lightweight RPC.** Worker reads/writes R2 directly. Only send extracted metadata to the DO (title, type, tags, aliases, links array, modified timestamp). Never send full note content over the RPC boundary.

3. **MCP-native errors.** All tool errors return `{ content: [{ type: "text", text: "error_type: message" }], isError: true }`. No custom error formats.

4. **Workspace-scoped from Phase 1.** All storage functions take `workspaceId` as a parameter. Don't hardcode a workspace and plan to refactor later.

5. **Both write and patch update indexes.** Every code path that modifies note content must: update R2 custom metadata AND call `WorkspaceIndex.noteUpdated()`.

6. **Section params use heading text without `#` prefix.** `"Meetings"` not `"## Meetings"`.

7. **Don't rewrite the OAuth plumbing.** Adapt the template's auth flow. Don't replace it.

## Go

Start with Phase 0. Keep going through every phase until the project is complete. Don't stop to ask — if a decision needs to be made and the specs are ambiguous, make the simplest choice that's consistent with the architecture docs, note it in a commit message, and move on.

Full send. Ship it.
