# Cairn — MCP Tool Specification

All tools are prefixed `cairn_` to namespace within an LLM's tool registry.

Paths never include the `.md` extension. The server appends it for R2 storage.

All errors use MCP's native error mechanism: `{ content: [{ type: "text", text: "error_type: message" }], isError: true }`.

## cairn_read

Read a note's content.

```json
{
  "name": "cairn_read",
  "description": "Read a note. Returns frontmatter metadata and markdown body. Use section to extract a specific heading. Use metadata_only to get just frontmatter and backlinks without the body.",
  "inputSchema": {
    "type": "object",
    "required": ["path"],
    "properties": {
      "path": {
        "type": "string",
        "description": "Note path e.g. 'entities/person/jamie' or 'daily/2026-02-24'"
      },
      "section": {
        "type": "string",
        "description": "Heading text (without # prefix) to extract just that section e.g. 'Meetings'. Matches the first heading with this text regardless of level."
      },
      "metadata_only": {
        "type": "boolean",
        "description": "Return only frontmatter + backlink list, skip body. Default false."
      }
    }
  }
}
```

**Response (content block):**
```
---
title: Jamie Wilson
type: person
tags: [co-founder, ceo]
modified: 2026-02-24T14:00:00Z
backlinks: [daily/2026-02-24, projects/brainwaves-v2]
---

# Jamie Wilson
CEO and co-founder of Brainwaves.
...
```

When `metadata_only: true`, body is omitted and backlinks include context snippets.

---

## cairn_write

Create or overwrite a note. Upsert semantics — the path can contain slashes for logical grouping (R2 is flat key-value storage, not a filesystem).

```json
{
  "name": "cairn_write",
  "description": "Create or overwrite a note. Frontmatter in content is parsed and merged with explicit params. WikiLinks in content are automatically indexed. Aliases allow this note to be found when other notes link using those names.",
  "inputSchema": {
    "type": "object",
    "required": ["path", "content"],
    "properties": {
      "path": {
        "type": "string",
        "description": "Note path e.g. 'entities/person/jamie'"
      },
      "content": {
        "type": "string",
        "description": "Full markdown body. May include YAML frontmatter."
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Tags to set (merged with any in frontmatter)"
      },
      "aliases": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Alternative names that resolve backlinks to this note"
      }
    }
  }
}
```

**Response:** `{ "path": "entities/person/jamie", "created": false, "links_found": 3 }`

**Side effects:**
- Writes note to R2
- Updates R2 custom metadata (title, type, tags, modified)
- Calls `WorkspaceIndex.noteUpdated()` with extracted metadata and wikilinks

---

## cairn_patch

Surgical edit without rewriting entire notes. The primary tool for incremental knowledge building.

```json
{
  "name": "cairn_patch",
  "description": "Edit a note without rewriting it. Supports append/prepend to the whole note or a specific section, and find-replace. The note must already exist. WikiLinks in new content are automatically indexed.",
  "inputSchema": {
    "type": "object",
    "required": ["path", "op", "content"],
    "properties": {
      "path": {
        "type": "string",
        "description": "Note path"
      },
      "op": {
        "type": "string",
        "enum": ["append", "prepend", "replace", "append_section", "prepend_section"],
        "description": "Operation type"
      },
      "content": {
        "type": "string",
        "description": "Content to insert or replacement text"
      },
      "section": {
        "type": "string",
        "description": "Heading text (without # prefix) for section ops e.g. 'Meetings'"
      },
      "find": {
        "type": "string",
        "description": "Substring to find for 'replace' op"
      }
    }
  }
}
```

**Operations:**

| op | behaviour |
|----|-----------|
| `append` | Add content to end of note body |
| `prepend` | Add content after frontmatter, before existing body |
| `replace` | Find `find` substring and replace with `content`. Fails if not found or ambiguous (appears more than once). |
| `append_section` | Add content to end of named `section` (before next heading of same or higher level). Requires `section`. |
| `prepend_section` | Add content at start of named `section` (after the heading line). Requires `section`. |

**Validation errors:**
- `replace` without `find` → error
- `append_section` or `prepend_section` without `section` → error
- `find` text not found → error
- `find` text appears more than once → error (ambiguous)
- `section` heading not found → error

**Response:** `{ "path": "daily/2026-02-24", "op": "append_section", "bytes_added": 342 }`

**Side effects:**
- Reads note from R2, applies patch, writes back to R2
- Updates R2 custom metadata (title, type, tags, modified)
- Calls `WorkspaceIndex.noteUpdated()` with re-extracted metadata and wikilinks

---

## cairn_delete

Delete a note and optionally clean up references.

```json
{
  "name": "cairn_delete",
  "description": "Delete a note. By default, also removes this note from the backlink index. Does not modify the content of other notes that reference this one.",
  "inputSchema": {
    "type": "object",
    "required": ["path"],
    "properties": {
      "path": {
        "type": "string",
        "description": "Note path to delete"
      }
    }
  }
}
```

**Response:** `{ "deleted": "entities/person/old-contact" }`

**Side effects:**
- Deletes note from R2
- Calls `WorkspaceIndex.noteDeleted()` which removes all index entries for this path (metadata, outgoing links, search terms, aliases)

Note: incoming backlink references from other notes remain in the index (as dangling links) unless those notes are themselves updated. This is intentional — the content of referencing notes is not modified.

---

## cairn_search

Full-text and metadata search. Returns snippets, not full documents.

**At least one parameter must be provided.** Calling with no params returns a validation error.

```json
{
  "name": "cairn_search",
  "description": "Search notes by content, tags, or backlinks. Returns matching note paths with context snippets. At least one search parameter is required.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Full-text search query"
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Filter to notes with all of these tags"
      },
      "path_prefix": {
        "type": "string",
        "description": "Scope search to a path prefix e.g. 'entities/person'"
      },
      "backlinks_to": {
        "type": "string",
        "description": "Find all notes that link to this path"
      },
      "modified_since": {
        "type": "string",
        "description": "ISO date — return only notes modified after this date"
      },
      "limit": {
        "type": "integer",
        "description": "Max results per page. Default 20."
      },
      "cursor": {
        "type": "string",
        "description": "Pagination cursor from previous response"
      }
    }
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "path": "daily/2026-02-24",
      "title": "2026-02-24",
      "snippet": "...discussed V2.1 launch with [[Jamie]]...",
      "tags": ["daily"],
      "modified": "2026-02-24T14:00:00Z"
    }
  ],
  "total": 3,
  "cursor": "eyJvZmZzZXQiOjIwfQ=="
}
```

The search is executed by the WorkspaceIndex DO against its SQLite tables. `query` matches against the `search_terms` inverted index. `tags`, `path_prefix`, `modified_since` filter the `notes` metadata table. `backlinks_to` queries the `links` table.

If `cursor` is present in the response, more results are available.

---

## cairn_links

Get the link graph around a note. No content returned — just structure.

```json
{
  "name": "cairn_links",
  "description": "Get backlinks and outgoing links for a note. Useful for understanding context and relationships without reading full documents.",
  "inputSchema": {
    "type": "object",
    "required": ["path"],
    "properties": {
      "path": {
        "type": "string",
        "description": "Note path"
      },
      "depth": {
        "type": "integer",
        "description": "Graph traversal depth. Default 1."
      },
      "direction": {
        "type": "string",
        "enum": ["in", "out", "both"],
        "description": "Link direction. Default 'both'."
      }
    }
  }
}
```

**Response:**
```json
{
  "path": "entities/person/jamie",
  "incoming": [
    { "path": "daily/2026-02-24", "title": "2026-02-24", "context": "Discussed V2.1 launch with [[Jamie]]" },
    { "path": "projects/brainwaves-v2", "title": "Brainwaves V2", "context": "Led by [[Jamie Wilson]]" }
  ],
  "outgoing": [
    { "path": "entities/company/brainwaves", "title": "Brainwaves" }
  ]
}
```

---

## cairn_daily

Sugar for daily note operations. Handles date path construction and auto-creation.

```json
{
  "name": "cairn_daily",
  "description": "Read or append to a daily note. Creates the note with minimal frontmatter if it doesn't exist. Date defaults to today (in workspace timezone).",
  "inputSchema": {
    "type": "object",
    "required": ["op"],
    "properties": {
      "date": {
        "type": "string",
        "description": "ISO date e.g. '2026-02-24'. Defaults to today in workspace timezone."
      },
      "op": {
        "type": "string",
        "enum": ["read", "append", "append_section", "prepend_section"],
        "description": "Operation. 'read' returns the full note. Others delegate to cairn_patch."
      },
      "content": {
        "type": "string",
        "description": "Content for append/section ops"
      },
      "section": {
        "type": "string",
        "description": "Heading text (without # prefix) for section ops e.g. 'Meetings'"
      }
    }
  }
}
```

**Behaviour:**
- Constructs path: `daily/{date}` (e.g. `daily/2026-02-24`)
- If note doesn't exist, creates it with frontmatter only (title = date, type = daily, tags = [daily])
- `read` → delegates to `cairn_read`
- `append`, `append_section`, `prepend_section` → delegates to `cairn_patch`

Note: `replace` is not available on `cairn_daily`. Use `cairn_patch` directly with the daily note path if you need find-replace.

---

## cairn_list

Lightweight directory listing with pagination.

```json
{
  "name": "cairn_list",
  "description": "List notes under a path prefix. Returns paths, titles, and modification dates. No content. Supports pagination.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path_prefix": {
        "type": "string",
        "description": "Path prefix to list. Default: root (all notes)."
      },
      "recursive": {
        "type": "boolean",
        "description": "Include nested paths. Default false."
      },
      "sort": {
        "type": "string",
        "enum": ["modified", "created", "alpha"],
        "description": "Sort order. Default 'modified' (most recent first)."
      },
      "limit": {
        "type": "integer",
        "description": "Max results per page. Default 20."
      },
      "cursor": {
        "type": "string",
        "description": "Pagination cursor from previous response"
      }
    }
  }
}
```

**Response:**
```json
{
  "path_prefix": "entities/person",
  "notes": [
    { "path": "entities/person/jamie", "title": "Jamie Wilson", "type": "person", "modified": "2026-02-24T14:00:00Z" },
    { "path": "entities/person/ben", "title": "Ben Smith", "type": "person", "modified": "2026-02-23T09:00:00Z" }
  ],
  "total": 15,
  "cursor": "eyJvZmZzZXQiOjIwfQ=="
}
```

Listing is powered by the WorkspaceIndex DO's `notes` SQLite table, which provides sorting and filtering without reading R2 objects. If `cursor` is present, more results are available.

---

## Section Parameter Convention

Several tools accept a `section` parameter. The convention is consistent across all tools:

- Pass the **heading text only**, without `#` prefix
- Example: `"Meetings"` not `"## Meetings"`
- Matches the **first** heading in the document with that text, regardless of heading level (`#`, `##`, `###`, etc.)
- If no heading matches, the tool returns a validation error
- Section scope extends from the heading line to just before the next heading of the same or higher level, or end of document

---

## Token Efficiency Notes

These tools are designed to minimise round-trips and token usage:

1. **`cairn_patch`** avoids read-then-write cycles. An LLM can append to 10 notes without ever reading them.
2. **`cairn_search`** returns snippets not full docs. The LLM reads full notes only when needed.
3. **`cairn_links`** returns structure only — the cheapest way to understand relationships.
4. **`cairn_daily`** eliminates date path construction and template logic from the LLM.
5. **`cairn_read` with `metadata_only`** lets the LLM check what exists without loading content.
6. **`cairn_list`** provides navigation without content — useful for "what do we have on X" questions.
7. **Pagination** on `cairn_list` and `cairn_search` prevents unbounded response sizes.
