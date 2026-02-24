# Cairn — MCP Tool Specification

All tools are prefixed `cairn_` to namespace within an LLM's tool registry.

Paths never include `.md` extension. The server appends it for R2 storage.

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
        "description": "Heading text to extract just that section and its children"
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

Create or overwrite a note. Upsert — creates parent "folders" implicitly.

```json
{
  "name": "cairn_write",
  "description": "Create or overwrite a note. Frontmatter in content is parsed and merged with explicit params. Backlinks in content are automatically indexed. Aliases allow this note to be found when other notes link using those names.",
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

**Response:** `{ "path": "entities/person/jamie", "created": false, "backlinks_updated": 3 }`

---

## cairn_patch

Surgical edit without rewriting entire notes. The primary tool for incremental knowledge building.

```json
{
  "name": "cairn_patch",
  "description": "Edit a note without rewriting it. Supports append/prepend to the whole note or a specific section, and find-replace. The note must already exist.",
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
        "description": "Target heading for section ops e.g. '## Meetings'"
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
| `replace` | Find `find` substring and replace with `content`. Fails if not found or ambiguous. |
| `append_section` | Add content to end of named `section` (before next heading of same or higher level) |
| `prepend_section` | Add content at start of named `section` (after the heading line) |

**Response:** `{ "path": "daily/2026-02-24", "op": "append_section", "bytes_added": 342 }`

---

## cairn_delete

Delete a note and optionally clean up references.

```json
{
  "name": "cairn_delete",
  "description": "Delete a note. By default, also removes backlink references to this note from other notes.",
  "inputSchema": {
    "type": "object",
    "required": ["path"],
    "properties": {
      "path": {
        "type": "string",
        "description": "Note path to delete"
      },
      "remove_backlinks": {
        "type": "boolean",
        "description": "Clean up [[references]] to this note in other notes. Default true."
      }
    }
  }
}
```

**Response:** `{ "deleted": "entities/person/old-contact", "backlinks_cleaned": 2 }`

---

## cairn_search

Full-text and metadata search. Returns snippets, not full documents.

```json
{
  "name": "cairn_search",
  "description": "Search notes by content, tags, or backlinks. Returns matching note paths with context snippets. Use backlinks_to to find all notes referencing a given note.",
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
        "description": "Scope search to a folder e.g. 'entities/person'"
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
        "description": "Max results. Default 10."
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
      "tags": ["meeting"],
      "modified": "2026-02-24T14:00:00Z",
      "score": 0.92
    }
  ],
  "total": 3
}
```

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
    { "path": "daily/2026-02-24", "title": "2026-02-24" },
    { "path": "projects/brainwaves-v2", "title": "Brainwaves V2" }
  ],
  "outgoing": [
    { "path": "entities/company/brainwaves", "title": "Brainwaves" }
  ]
}
```

---

## cairn_daily

Sugar for daily note operations. Handles date path construction and default templates.

```json
{
  "name": "cairn_daily",
  "description": "Read or append to a daily note. Creates the note from workspace template if it doesn't exist. Date defaults to today.",
  "inputSchema": {
    "type": "object",
    "required": ["op"],
    "properties": {
      "date": {
        "type": "string",
        "description": "ISO date e.g. '2026-02-24'. Defaults to today."
      },
      "op": {
        "type": "string",
        "enum": ["read", "append", "replace"],
        "description": "Operation"
      },
      "content": {
        "type": "string",
        "description": "Content for append/replace ops"
      },
      "section": {
        "type": "string",
        "description": "Target section heading e.g. '## Meetings'"
      }
    }
  }
}
```

---

## cairn_list

Lightweight directory listing.

```json
{
  "name": "cairn_list",
  "description": "List notes under a path prefix. Returns paths, titles, and modification dates. No content.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path_prefix": {
        "type": "string",
        "description": "Folder to list. Default: root."
      },
      "recursive": {
        "type": "boolean",
        "description": "Include nested paths. Default false."
      },
      "sort": {
        "type": "string",
        "enum": ["modified", "created", "alpha"],
        "description": "Sort order. Default 'modified'."
      },
      "limit": {
        "type": "integer",
        "description": "Max results. Default 20."
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
    { "path": "entities/person/jamie", "title": "Jamie Wilson", "modified": "2026-02-24T14:00:00Z" },
    { "path": "entities/person/ben", "title": "Ben Smith", "modified": "2026-02-23T09:00:00Z" }
  ],
  "total": 2
}
```

---

## Token Efficiency Notes

These tools are designed to minimise round-trips and token usage:

1. **`cairn_patch`** avoids read-then-write cycles. An LLM can append to 10 notes without ever reading them.
2. **`cairn_search`** returns snippets not full docs. The LLM reads full notes only when needed.
3. **`cairn_links`** returns structure only — the cheapest way to understand relationships.
4. **`cairn_daily`** eliminates date path construction and template logic from the LLM.
5. **`cairn_read` with `metadata_only`** lets the LLM check what exists without loading content.
6. **`cairn_list`** provides navigation without content — useful for "what do we have on X" questions.
