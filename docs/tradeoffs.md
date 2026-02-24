# Architectural Trade-offs and Accepted Risks

Reference document for known trade-offs in the Cairn codebase. Items listed here have been evaluated and accepted. They should not be re-raised in future audits unless the project's constraints change.

## Known Trade-offs

### R2 custom metadata is write-only

`buildCustomMetadata()` in `src/storage/notes.ts` writes title, type, tags, and modified to R2 custom metadata on every put. No code reads this metadata back -- `readNote()` parses frontmatter from the content body instead. The metadata is written because it is free (same PUT request) and useful when inspecting the R2 bucket in the Cloudflare dashboard. R2 custom metadata has a 2KB limit; a note with an unusually large number of tags could theoretically fail a put, but this is unlikely in practice.

### Double R2 operation on write

`writeNote()` performs `bucket.head()` then `bucket.put()` to determine whether the note already exists (used for the `created` flag and to preserve the original `created` timestamp). HEAD is a Class C operation, cheaper than the Class B GET alternative. Always returning `created: true` or using conditional puts would reduce one operation but adds complexity for marginal savings.

### Search snippet enrichment fetches from R2

`search.ts` fires up to 20 parallel R2 GETs per search query to extract body snippets for results. This is the correct trade-off given the "no content over RPC boundary" constraint -- the DO index cannot store full note bodies. If R2 billing becomes an issue, the escape hatch is to store a truncated abstract (first ~200 chars of body) in the DO SQLite index and return that instead.

### No conditional writes (last-write-wins)

Two concurrent MCP clients writing the same note both perform `head()` then `put()` with no versioning or etag checks. R2 supports conditional puts via `onlyIf: { etagMatches }` but we do not use it. For the primary single-user knowledge base use case this is acceptable. For shared workspaces with concurrent editors, this is a known data loss vector. Fix: add etag-based conditional puts if real-time collaboration is needed.

### DO locality pinned at creation

WorkspaceIndex Durable Objects run in whichever datacenter first accesses them. Cross-region collaborators will see roughly 200ms extra latency per tool call. Cloudflare Smart Placement could help but is not configured. For MCP tool calls (not real-time UI), this latency is acceptable.

### Two DO hops per MCP tool call

Every tool invocation hits the CairnMCP DO (MCP agent / protocol state) then the WorkspaceIndex DO (index queries and updates). That is two DOs billed per operation. This is inherent to the architecture -- the MCP agent and the workspace index are separate concerns with separate state. The cost model is 2x what a casual read of "one DO per workspace" might suggest.

### rebuildIndex can timeout on large workspaces

`rebuildIndex()` in `src/storage/workspace-index.ts` iterates all notes sequentially in a single DO request. DO requests have a ~120s soft limit, which caps practical throughput at roughly 2000-2500 notes depending on note size. Fix: batch processing via DO alarms (process N notes, save cursor to storage, set alarm, continue on next invocation). This is tracked for implementation but not yet built.

## Accepted Design Decisions

### "default" workspace skips membership check

Any authenticated user (must still complete OAuth) can read and write the "default" workspace without explicit membership. This is visible in `src/index.ts` where the membership check is gated behind `workspaceId !== "default"`. This is the intended sandbox and onboarding experience. All other workspaces require membership.

### CairnMCP DO uses SQLite but does not write to it directly

The `wrangler.jsonc` migration declares CairnMCP as a `new_sqlite_classes` entry. This SQLite database is managed internally by the Agents SDK for MCP protocol state (session tracking, etc.). Our application code does not read from or write to this database. The migration is required by the SDK, not by our code.

### Timezone defaults to Australia/Melbourne

When the workspace is "default" or the workspace metadata has no timezone set, `CairnMCP.init()` falls back to `"Australia/Melbourne"` rather than UTC. This is a developer convenience for the project author. Production workspaces should set their timezone explicitly via workspace settings.
