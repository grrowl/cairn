import { DurableObject } from "cloudflare:workers";

export interface NoteMetadata {
  title: string;
  type: string;
  tags: string[];
  aliases: string[];
  links: { target: string; context: string }[];
  created: string;
  modified: string;
}

export interface ListParams {
  pathPrefix?: string;
  recursive?: boolean;
  sort?: "modified" | "created" | "alpha";
  limit?: number;
  cursor?: string;
}

export interface ListResult {
  notes: { path: string; title: string; type: string; modified: string }[];
  total: number;
  cursor?: string;
}

export interface SearchParams {
  query?: string;
  tags?: string[];
  pathPrefix?: string;
  backlinksTo?: string;
  modifiedSince?: string;
  limit?: number;
  cursor?: string;
}

export interface SearchResult {
  results: { path: string; title: string; snippet?: string; tags: string[]; modified: string }[];
  total: number;
  cursor?: string;
}

export interface LinkResult {
  path: string;
  incoming: { path: string; title: string; context: string }[];
  outgoing: { path: string; title: string; context: string }[];
}

export class WorkspaceIndex extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initTables();
  }

  private initTables() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        path TEXT PRIMARY KEY,
        title TEXT,
        type TEXT,
        tags TEXT,
        aliases TEXT,
        created TEXT,
        modified TEXT
      );
      CREATE TABLE IF NOT EXISTS links (
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        context TEXT,
        PRIMARY KEY (source_path, target_path)
      );
      CREATE TABLE IF NOT EXISTS aliases (
        alias TEXT PRIMARY KEY,
        canonical_path TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS search_terms (
        term TEXT NOT NULL,
        path TEXT NOT NULL,
        PRIMARY KEY (term, path)
      );
    `);
  }

  async ping(): Promise<{ status: string; timestamp: string }> {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  async noteUpdated(_path: string, _metadata: NoteMetadata): Promise<void> {
    // Stub — implemented in Phase 1
  }

  async noteDeleted(_path: string): Promise<void> {
    // Stub — implemented in Phase 1
  }

  async search(_params: SearchParams): Promise<SearchResult> {
    return { results: [], total: 0 };
  }

  async listNotes(_params: ListParams): Promise<ListResult> {
    return { notes: [], total: 0 };
  }

  async getLinks(_path: string, _depth: number, _direction: string): Promise<LinkResult> {
    return { path: _path, incoming: [], outgoing: [] };
  }

  async resolveAlias(_alias: string): Promise<string | null> {
    return null;
  }

  async rebuildIndex(): Promise<{ notes_indexed: number }> {
    return { notes_indexed: 0 };
  }
}
