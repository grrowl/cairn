/**
 * R2-backed note storage operations.
 * All functions are workspace-scoped via workspaceId parameter.
 */

import { parseFrontmatter, serialiseFrontmatter, type Frontmatter, type ParsedNote } from "./frontmatter";
import { appendToSection, prependToSection } from "./markdown";
import { extractLinks, type ExtractedLink } from "./wikilinks";

export interface NoteResult extends ParsedNote {
	links: ExtractedLink[];
}

export interface WriteResult {
	path: string;
	created: boolean;
	frontmatter: Frontmatter;
	links: ExtractedLink[];
}

export interface PatchResult {
	path: string;
	op: string;
	bytesAdded: number;
	frontmatter: Frontmatter;
	links: ExtractedLink[];
}

function r2Key(workspaceId: string, path: string): string {
	return `${workspaceId}/notes/${path}.md`;
}

function buildCustomMetadata(fm: Frontmatter): Record<string, string> {
	const meta: Record<string, string> = {};
	if (fm.title) meta.title = fm.title;
	if (fm.type) meta.type = fm.type;
	if (fm.tags && fm.tags.length > 0) meta.tags = fm.tags.join(",");
	if (fm.modified) meta.modified = fm.modified;
	return meta;
}

export async function readNote(
	bucket: R2Bucket,
	workspaceId: string,
	path: string,
): Promise<NoteResult | null> {
	const obj = await bucket.get(r2Key(workspaceId, path));
	if (!obj) return null;

	const raw = await obj.text();
	const parsed = parseFrontmatter(raw);
	const links = extractLinks(parsed.body);

	return { ...parsed, links };
}

export async function writeNote(
	bucket: R2Bucket,
	workspaceId: string,
	path: string,
	content: string,
	overrides?: { tags?: string[]; aliases?: string[] },
): Promise<WriteResult> {
	const key = r2Key(workspaceId, path);

	// Check if note already exists (for created flag and preserving created timestamp)
	const existing = await bucket.head(key);
	const now = new Date().toISOString();

	// Parse incoming content for frontmatter
	const parsed = parseFrontmatter(content);
	const fm = parsed.frontmatter;

	// Merge overrides
	if (overrides?.tags) {
		const existingTags = fm.tags || [];
		const merged = new Set([...existingTags, ...overrides.tags]);
		fm.tags = [...merged];
	}
	if (overrides?.aliases) {
		const existingAliases = fm.aliases || [];
		const merged = new Set([...existingAliases, ...overrides.aliases]);
		fm.aliases = [...merged];
	}

	// Set timestamps
	if (!existing) {
		fm.created = fm.created || now;
	}
	fm.modified = now;

	// Derive title from path if not set
	if (!fm.title) {
		const segments = path.split("/");
		fm.title = segments[segments.length - 1];
	}

	// Serialize and write
	const finalContent = serialiseFrontmatter(fm, parsed.body);
	const customMetadata = buildCustomMetadata(fm);

	await bucket.put(key, finalContent, {
		httpMetadata: { contentType: "text/markdown" },
		customMetadata,
	});

	const links = extractLinks(parsed.body);

	return {
		path,
		created: !existing,
		frontmatter: fm,
		links,
	};
}

export async function deleteNote(
	bucket: R2Bucket,
	workspaceId: string,
	path: string,
): Promise<boolean> {
	const key = r2Key(workspaceId, path);
	const existing = await bucket.head(key);
	if (!existing) return false;

	await bucket.delete(key);
	return true;
}

export async function patchNote(
	bucket: R2Bucket,
	workspaceId: string,
	path: string,
	op: string,
	content: string,
	section?: string,
	find?: string,
): Promise<PatchResult> {
	const key = r2Key(workspaceId, path);
	const obj = await bucket.get(key);
	if (!obj) {
		throw new PatchError("not_found", `Note '${path}' does not exist`);
	}

	const raw = await obj.text();
	const parsed = parseFrontmatter(raw);
	let newBody = parsed.body;

	switch (op) {
		case "append":
			newBody = parsed.body + (parsed.body.endsWith("\n") ? "" : "\n") + content;
			break;

		case "prepend":
			newBody = content + (content.endsWith("\n") ? "" : "\n") + parsed.body;
			break;

		case "replace": {
			if (!find) {
				throw new PatchError("validation_error", "'replace' op requires 'find' parameter");
			}
			const count = parsed.body.split(find).length - 1;
			if (count === 0) {
				throw new PatchError("not_found", `'find' text not found in note '${path}'`);
			}
			if (count > 1) {
				throw new PatchError("conflict", `'find' text appears ${count} times in note '${path}' (ambiguous)`);
			}
			newBody = parsed.body.replace(find, content);
			break;
		}

		case "append_section": {
			if (!section) {
				throw new PatchError("validation_error", "'append_section' op requires 'section' parameter");
			}
			const result = appendToSection(parsed.body, section, content);
			if (result === null) {
				throw new PatchError("not_found", `Section '${section}' not found in note '${path}'`);
			}
			newBody = result;
			break;
		}

		case "prepend_section": {
			if (!section) {
				throw new PatchError("validation_error", "'prepend_section' op requires 'section' parameter");
			}
			const result = prependToSection(parsed.body, section, content);
			if (result === null) {
				throw new PatchError("not_found", `Section '${section}' not found in note '${path}'`);
			}
			newBody = result;
			break;
		}

		default:
			throw new PatchError("validation_error", `Unknown op '${op}'`);
	}

	// Update modified timestamp
	const now = new Date().toISOString();
	parsed.frontmatter.modified = now;

	const finalContent = serialiseFrontmatter(parsed.frontmatter, newBody);
	const customMetadata = buildCustomMetadata(parsed.frontmatter);

	await bucket.put(key, finalContent, {
		httpMetadata: { contentType: "text/markdown" },
		customMetadata,
	});

	const bytesAdded = new TextEncoder().encode(finalContent).byteLength - new TextEncoder().encode(raw).byteLength;
	const links = extractLinks(newBody);

	return {
		path,
		op,
		bytesAdded,
		frontmatter: parsed.frontmatter,
		links,
	};
}

export class PatchError extends Error {
	constructor(
		public readonly errorType: string,
		message: string,
	) {
		super(message);
		this.name = "PatchError";
	}
}
