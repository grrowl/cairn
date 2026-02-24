import { DurableObject } from "cloudflare:workers";
import { parseFrontmatter } from "./frontmatter";
import { extractLinks } from "./wikilinks";

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

/** Tokenise text for the search_terms inverted index. */
function tokenise(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[\s\p{P}]+/u)
		.filter((t) => t.length >= 3);
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
			CREATE INDEX IF NOT EXISTS idx_search_terms_term ON search_terms(term);
			CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path);
			CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_path);
			CREATE INDEX IF NOT EXISTS idx_aliases_canonical ON aliases(canonical_path);
		`);
	}

	async ping(): Promise<{ status: string; timestamp: string }> {
		return { status: "ok", timestamp: new Date().toISOString() };
	}

	async checkAliasConflicts(path: string, aliases: string[]): Promise<string[]> {
		const conflicts: string[] = [];
		for (const alias of aliases) {
			const normalised = alias.toLowerCase().trim();
			if (!normalised) continue;
			const existing = [...this.sql.exec<{ canonical_path: string }>(
				"SELECT canonical_path FROM aliases WHERE alias = ?",
				normalised,
			)];
			if (existing.length > 0 && existing[0].canonical_path !== path) {
				conflicts.push(
					`alias '${alias}' is already claimed by '${existing[0].canonical_path}'`,
				);
			}
		}
		return conflicts;
	}

	async noteUpdated(path: string, metadata: NoteMetadata): Promise<void> {
		// Get existing created timestamp if note already exists
		const existingRows = [...this.sql.exec<{ created: string }>(
			"SELECT created FROM notes WHERE path = ?",
			path,
		)];
		const existingCreated = existingRows.length > 0 ? existingRows[0].created : null;

		// Upsert note metadata
		this.sql.exec(
			`INSERT OR REPLACE INTO notes (path, title, type, tags, aliases, created, modified)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			path,
			metadata.title,
			metadata.type || "",
			JSON.stringify(metadata.tags || []),
			JSON.stringify(metadata.aliases || []),
			existingCreated || metadata.created,
			metadata.modified,
		);

		// Update search terms: delete old, insert new
		this.sql.exec("DELETE FROM search_terms WHERE path = ?", path);
		const linkContexts = (metadata.links || []).map((l) => l.context).join(" ");
		const pathTerms = path.replace(/[/_-]/g, " ");
		const terms = new Set(tokenise(
			`${metadata.title} ${(metadata.tags || []).join(" ")} ${(metadata.aliases || []).join(" ")} ${pathTerms} ${linkContexts}`,
		));
		for (const term of terms) {
			this.sql.exec(
				"INSERT OR IGNORE INTO search_terms (term, path) VALUES (?, ?)",
				term,
				path,
			);
		}

		// Update aliases
		this.sql.exec("DELETE FROM aliases WHERE canonical_path = ?", path);
		for (const alias of metadata.aliases || []) {
			const normalised = alias.toLowerCase().trim();
			if (normalised) {
				this.sql.exec(
					"INSERT OR REPLACE INTO aliases (alias, canonical_path) VALUES (?, ?)",
					normalised,
					path,
				);
			}
		}

		// Update outgoing links: delete old, insert new
		this.sql.exec("DELETE FROM links WHERE source_path = ?", path);
		for (const link of metadata.links || []) {
			// Resolve alias to canonical path
			const resolved = await this.resolveAlias(link.target);
			const targetPath = resolved || link.target;
			this.sql.exec(
				"INSERT OR REPLACE INTO links (source_path, target_path, context) VALUES (?, ?, ?)",
				path,
				targetPath,
				link.context || "",
			);
		}

	}

	async noteDeleted(path: string): Promise<void> {
		this.sql.exec("DELETE FROM notes WHERE path = ?", path);
		this.sql.exec("DELETE FROM search_terms WHERE path = ?", path);
		this.sql.exec("DELETE FROM links WHERE source_path = ?", path);
		this.sql.exec("DELETE FROM aliases WHERE canonical_path = ?", path);
	}

	async search(params: SearchParams): Promise<SearchResult> {
		const limit = params.limit || 20;
		const offset = params.cursor ? parseInt(atob(params.cursor), 10) : 0;

		// Build query conditions
		const conditions: string[] = [];
		const queryParams: (string | number)[] = [];

		if (params.query) {
			// Search using inverted index with prefix matching
			const searchTerms = tokenise(params.query);
			if (searchTerms.length > 0) {
				// Each term must match at least one search_term (prefix match via LIKE)
				// All terms must match (INTERSECT)
				const subqueries = searchTerms.map(
					() => "SELECT path FROM search_terms WHERE term LIKE ?",
				);
				const combined = subqueries.join(" INTERSECT ");
				conditions.push(`n.path IN (${combined})`);
				queryParams.push(...searchTerms.map((t) => `${t}%`));
			}
		}

		if (params.tags && params.tags.length > 0) {
			// Filter by tags — each tag must be present in the JSON array
			for (const tag of params.tags) {
				conditions.push(`n.tags LIKE ?`);
				queryParams.push(`%"${tag}"%`);
			}
		}

		if (params.pathPrefix) {
			conditions.push(`n.path LIKE ?`);
			queryParams.push(`${params.pathPrefix}%`);
		}

		if (params.modifiedSince) {
			conditions.push(`n.modified > ?`);
			queryParams.push(params.modifiedSince);
		}

		if (params.backlinksTo) {
			conditions.push(
				`n.path IN (SELECT source_path FROM links WHERE target_path = ?)`,
			);
			queryParams.push(params.backlinksTo);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

		// Get total count
		const countRows = [...this.sql.exec<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM notes n ${whereClause}`,
			...queryParams,
		)];
		const total = countRows[0]?.cnt || 0;

		// Get page of results
		const rows = [...this.sql.exec<{ path: string; title: string; tags: string; modified: string }>(
			`SELECT n.path, n.title, n.tags, n.modified FROM notes n ${whereClause} ORDER BY n.modified DESC LIMIT ? OFFSET ?`,
			...queryParams,
			limit,
			offset,
		)];

		const results = rows.map((row) => ({
			path: row.path,
			title: row.title,
			tags: safeParseTags(row.tags),
			modified: row.modified,
		}));

		const nextOffset = offset + limit;
		const cursor = nextOffset < total ? btoa(String(nextOffset)) : undefined;

		return { results, total, cursor };
	}

	async listNotes(params: ListParams): Promise<ListResult> {
		const limit = params.limit || 20;
		const offset = params.cursor ? parseInt(atob(params.cursor), 10) : 0;

		const conditions: string[] = [];
		const queryParams: (string | number)[] = [];

		if (params.pathPrefix) {
			if (params.recursive) {
				conditions.push("path LIKE ?");
				queryParams.push(`${params.pathPrefix}%`);
			} else {
				// Non-recursive: only direct children (no additional / after prefix)
				conditions.push("path LIKE ? AND path NOT LIKE ?");
				queryParams.push(`${params.pathPrefix}%`, `${params.pathPrefix}%/%`);
			}
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

		let orderBy: string;
		switch (params.sort) {
			case "created":
				orderBy = "created DESC";
				break;
			case "alpha":
				orderBy = "path ASC";
				break;
			default:
				orderBy = "modified DESC";
		}

		// Total count
		const countRows = [...this.sql.exec<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM notes ${whereClause}`,
			...queryParams,
		)];
		const total = countRows[0]?.cnt || 0;

		// Get page
		const rows = [...this.sql.exec<{ path: string; title: string; type: string; modified: string }>(
			`SELECT path, title, type, modified FROM notes ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
			...queryParams,
			limit,
			offset,
		)];

		const nextOffset = offset + limit;
		const cursor = nextOffset < total ? btoa(String(nextOffset)) : undefined;

		return { notes: rows, total, cursor };
	}

	async getLinks(path: string, depth: number = 1, direction: string = "both"): Promise<LinkResult> {
		const result: LinkResult = { path, incoming: [], outgoing: [] };

		if (direction === "in" || direction === "both") {
			result.incoming = this.getIncomingLinks(path, depth);
		}

		if (direction === "out" || direction === "both") {
			result.outgoing = this.getOutgoingLinks(path, depth);
		}

		return result;
	}

	private getIncomingLinks(path: string, depth: number): { path: string; title: string; context: string }[] {
		const visited = new Set<string>();
		let currentPaths = [path];
		const results: { path: string; title: string; context: string }[] = [];

		for (let d = 0; d < depth; d++) {
			const nextPaths: string[] = [];
			for (const p of currentPaths) {
				if (visited.has(p)) continue;
				visited.add(p);

				const rows = [...this.sql.exec<{ source_path: string; context: string }>(
					"SELECT source_path, context FROM links WHERE target_path = ?",
					p,
				)];

				for (const row of rows) {
					if (visited.has(row.source_path)) continue;

					const noteRows = [...this.sql.exec<{ title: string }>(
						"SELECT title FROM notes WHERE path = ?",
						row.source_path,
					)];
					const title = noteRows[0]?.title || row.source_path;

					results.push({ path: row.source_path, title, context: row.context });
					nextPaths.push(row.source_path);
				}
			}
			currentPaths = nextPaths;
		}

		return results;
	}

	private getOutgoingLinks(path: string, depth: number): { path: string; title: string; context: string }[] {
		const visited = new Set<string>();
		let currentPaths = [path];
		const results: { path: string; title: string; context: string }[] = [];

		for (let d = 0; d < depth; d++) {
			const nextPaths: string[] = [];
			for (const p of currentPaths) {
				if (visited.has(p)) continue;
				visited.add(p);

				const rows = [...this.sql.exec<{ target_path: string; context: string }>(
					"SELECT target_path, context FROM links WHERE source_path = ?",
					p,
				)];

				for (const row of rows) {
					if (visited.has(row.target_path)) continue;

					const noteRows = [...this.sql.exec<{ title: string }>(
						"SELECT title FROM notes WHERE path = ?",
						row.target_path,
					)];
					const title = noteRows[0]?.title || row.target_path;

					results.push({ path: row.target_path, title, context: row.context });
					nextPaths.push(row.target_path);
				}
			}
			currentPaths = nextPaths;
		}

		return results;
	}

	async resolveAlias(alias: string): Promise<string | null> {
		const normalised = alias.toLowerCase().trim();
		const rows = [...this.sql.exec<{ canonical_path: string }>(
			"SELECT canonical_path FROM aliases WHERE alias = ?",
			normalised,
		)];
		return rows.length > 0 ? rows[0].canonical_path : null;
	}

	async rebuildIndex(workspaceId?: string): Promise<{ notes_indexed: number }> {
		// Clear all existing data
		this.sql.exec("DELETE FROM notes");
		this.sql.exec("DELETE FROM links");
		this.sql.exec("DELETE FROM aliases");
		this.sql.exec("DELETE FROM search_terms");

		if (!workspaceId) {
			return { notes_indexed: 0 };
		}

		const bucket = this.env.BUCKET;
		let notesIndexed = 0;
		let cursor: string | undefined;

		do {
			const listed = await bucket.list({
				prefix: `${workspaceId}/notes/`,
				cursor,
			});

			for (const obj of listed.objects) {
				try {
					const r2obj = await bucket.get(obj.key);
					if (!r2obj) continue;

					const raw = await r2obj.text();
					const parsed = parseFrontmatter(raw);
					const links = extractLinks(parsed.body);

					// Derive path from R2 key: remove "{workspaceId}/notes/" prefix and ".md" suffix
					const path = obj.key
						.replace(`${workspaceId}/notes/`, "")
						.replace(/\.md$/, "");

					const metadata: NoteMetadata = {
						title: parsed.frontmatter.title || path,
						type: parsed.frontmatter.type || "",
						tags: parsed.frontmatter.tags || [],
						aliases: parsed.frontmatter.aliases || [],
						links: links.map((l) => ({ target: l.target, context: l.context })),
						created: parsed.frontmatter.created || "",
						modified: parsed.frontmatter.modified || "",
					};

					await this.noteUpdated(path, metadata);
					notesIndexed++;
				} catch (err) {
					console.error(`rebuildIndex: failed to index ${obj.key}:`, err);
				}
			}

			cursor = listed.truncated ? listed.cursor : undefined;
		} while (cursor);

		return { notes_indexed: notesIndexed };
	}
}

function safeParseTags(tagsJson: string): string[] {
	try {
		const parsed = JSON.parse(tagsJson);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
