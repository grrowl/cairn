# Cairn — Requirements

## Overview

Cairn is a remote-first, markdown-based knowledge management system designed for LLM-native workflows. Its primary interface is MCP (Model Context Protocol), enabling AI assistants to read, write, and cross-reference notes on behalf of users.

The core use case is ingesting meeting transcripts and call recordings, extracting entities (people, companies, decisions), linking them to daily notes, and building a navigable knowledge graph over time.

## Tenancy Model

### Workspaces

A **workspace** is the top-level isolation boundary. All notes, backlinks, and metadata are scoped to a workspace.

- Each workspace has a unique `workspaceId` (slug, e.g. `brainwaves`, `personal`)
- R2 storage is prefixed: `{workspaceId}/...`
- MCP endpoint is scoped: `/{workspaceId}/mcp`
- A user can belong to multiple workspaces

### Roles

| Role | Capabilities |
|------|-------------|
| **admin** | Full access to all workspaces. Can create/delete workspaces, manage members. Platform-level role. |
| **owner** | Full access within their workspace. Can invite/remove members, manage workspace settings. |
| **member** | Read/write notes within their workspace. Cannot manage members or settings. |

Tom (platform admin) has visibility across all workspaces.

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
    "daily_note_template": "## Meetings\n\n## Decisions\n\n## Notes\n",
    "entity_types": ["person", "company", "project", "topic"]
  }
}
```

## Authentication

### Google OAuth 2.0

- Standard OAuth 2.0 authorization code flow
- Scopes: `openid email profile`
- Hosted on Cloudflare Workers, callback at `/auth/callback`
- Session stored as signed JWT in httpOnly cookie
- JWT contains: `sub` (google ID), `email`, `name`, `exp`

### MCP Authentication

MCP connections at `/{workspaceId}/mcp` are authenticated via:

1. **Bearer token** — OAuth access token passed in MCP auth header
2. **Session cookie** — for browser-based MCP clients

On each MCP request, the server:
1. Validates the token/session
2. Resolves the user's email
3. Checks membership in the target workspace
4. Rejects if not a member (or admin)

### Admin Override

The platform admin email is configured via `ADMIN_EMAIL` env var. This user:
- Can access any workspace's MCP endpoint
- Can see all workspaces in the admin UI
- Can manage membership of any workspace

## Storage Layer (R2)

### Object Key Schema

All objects in the R2 bucket follow this prefix convention:

```
{workspaceId}/notes/{path}.md          # note content (markdown + frontmatter)
{workspaceId}/index/backlinks.json     # backlink index for the workspace
{workspaceId}/index/search.json        # search index (trigram or simple inverted index)
{workspaceId}/index/aliases.json       # alias → canonical path mapping
_system/workspaces/{workspaceId}.json  # workspace metadata
_system/users/{email}.json             # user profile + workspace memberships
```

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

### Backlink Index

Rather than scanning all notes for links on every request, we maintain an inverted index:

```json
{
  "entities/person/jamie": {
    "incoming": [
      { "from": "daily/2026-02-24", "context": "Discussed V2.1 launch timeline with [[Jamie]]" },
      { "from": "projects/brainwaves-v2", "context": "Led by [[Jamie Wilson]]" }
    ]
  }
}
```

Updated on every write/patch/delete operation. Aliases are resolved at write time — writing `[[Jamie]]` updates the backlink index for `entities/person/jamie` if that alias exists.

### Search Index

Lightweight inverted index stored in R2, rebuilt incrementally on writes:

```json
{
  "terms": {
    "brainwaves": ["entities/company/brainwaves", "daily/2026-02-24"],
    "fundraise": ["daily/2026-02-20", "projects/q1-raise"]
  },
  "metadata": {
    "entities/person/jamie": { "title": "Jamie Wilson", "tags": ["co-founder"], "modified": "..." }
  }
}
```

For MVP, this is a simple word-level inverted index. Can later migrate to D1 or Vectorize for better search.

### Concurrency & Consistency

- R2 doesn't support conditional writes natively
- For MVP: last-write-wins on full note writes
- Backlink and search index updates use a Durable Object as a write coordinator to serialise index mutations
- Patch operations (append/prepend) read-then-write within the DO to ensure consistency

## MCP Server

### Transport

Using Cloudflare's MCP server template with **Streamable HTTP transport** at `/{workspaceId}/mcp`.

### Tools

See [mcp-spec.md](./mcp-spec.md) for full tool definitions.

Summary:
- `cairn_read` — read note content, optionally just a section or metadata
- `cairn_write` — create/overwrite a note (upsert)
- `cairn_patch` — append, prepend, or replace within a note
- `cairn_delete` — delete a note, optionally clean up backlinks
- `cairn_search` — full-text + metadata search, returns snippets
- `cairn_links` — get backlink graph around a note
- `cairn_daily` — shortcut for daily note operations
- `cairn_list` — list notes in a path prefix

### Error Handling

MCP tool responses use standard error format:
- `not_found` — note doesn't exist
- `unauthorized` — not a member of this workspace
- `conflict` — concurrent write detected (future)
- `validation_error` — bad params

## Frontend

Minimal admin SPA served from the worker at `/`.

### Pages

1. **Login** — Google OAuth sign-in button
2. **Workspaces** — list workspaces you belong to, create new ones
3. **Workspace Settings** — member management (invite by email, remove, change role)
4. **Note Browser** (stretch) — simple tree view + markdown preview of workspace contents

### Tech

- Single HTML file with inline JS/CSS (served from worker, no build step)
- Calls workspace management API endpoints on the same worker
- Auth via session cookie

## API Routes

```
GET  /                                  # frontend SPA
GET  /auth/login                        # initiate Google OAuth
GET  /auth/callback                     # OAuth callback
POST /auth/logout                       # clear session

GET  /api/workspaces                    # list user's workspaces
POST /api/workspaces                    # create workspace
GET  /api/workspaces/:id                # workspace details
PUT  /api/workspaces/:id                # update workspace settings
DELETE /api/workspaces/:id              # delete workspace (admin only)

GET  /api/workspaces/:id/members        # list members
POST /api/workspaces/:id/members        # invite member
DELETE /api/workspaces/:id/members/:email  # remove member

POST /:workspaceId/mcp                  # MCP endpoint (streamable HTTP)
```

## Non-Functional Requirements

- **Latency**: MCP tool calls should complete in <200ms for reads, <500ms for writes (index update included)
- **Storage**: No hard limits for MVP, but note size capped at 1MB
- **Availability**: Cloudflare Workers SLA, R2 durability
- **Cost**: Should run comfortably within Cloudflare free/pro tier for personal use
- **Sync**: Out of scope for V1. Future: local Obsidian vault ↔ Cairn sync via CLI or plugin

## Future / Out of Scope for V1

- Real-time collaboration / CRDT sync
- Obsidian vault sync (CLI or plugin)
- Vectorize-powered semantic search
- File attachments (images, PDFs)
- Note versioning / history
- Webhook notifications on note changes
- Public sharing of individual notes
