import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkspaceIndex } from "../../storage/workspace-index";
import { readNote } from "../../storage/notes";

export const searchSchema = {
	query: z.string().optional().describe("Full-text search query"),
	tags: z.array(z.string()).optional().describe("Filter to notes with all of these tags"),
	path_prefix: z.string().optional().describe("Scope search to a path prefix e.g. 'entities/person'"),
	backlinks_to: z.string().optional().describe("Find all notes that link to this path"),
	modified_since: z.string().optional().describe("ISO date — return only notes modified after this date"),
	limit: z.number().int().optional().describe("Max results per page. Default 20."),
	cursor: z.string().optional().describe("Pagination cursor from previous response"),
};

/** Extract a snippet around the first occurrence of any query term in the body. */
function extractSnippet(body: string, query: string | undefined, maxLen = 120): string | undefined {
	if (!query || !body) return undefined;
	const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
	if (terms.length === 0) return undefined;

	const lower = body.toLowerCase();
	let bestIdx = -1;
	for (const term of terms) {
		const idx = lower.indexOf(term);
		if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
			bestIdx = idx;
		}
	}
	if (bestIdx === -1) return undefined;

	const start = Math.max(0, bestIdx - 40);
	const end = Math.min(body.length, bestIdx + maxLen - 40);
	const raw = body.slice(start, end).replace(/\n+/g, " ").trim();
	return (start > 0 ? "..." : "") + raw + (end < body.length ? "..." : "");
}

export function registerSearchTool(
	server: McpServer,
	getIndex: () => DurableObjectStub<WorkspaceIndex>,
	getBucket: () => R2Bucket,
	getWorkspaceId: () => string,
) {
	server.tool(
		"cairn_search",
		"Search notes by content, tags, or backlinks. Returns matching note paths with context snippets. At least one search parameter is required.",
		searchSchema,
		async ({ query, tags, path_prefix, backlinks_to, modified_since, limit, cursor }) => {
			// Validate at least one search param
			if (!query && (!tags || tags.length === 0) && !path_prefix && !backlinks_to && !modified_since) {
				return {
					content: [{ type: "text" as const, text: "validation_error: At least one search parameter is required" }],
					isError: true,
				};
			}

			const index = getIndex();
			const result = await index.search({
				query,
				tags,
				pathPrefix: path_prefix,
				backlinksTo: backlinks_to,
				modifiedSince: modified_since,
				limit: limit || 20,
				cursor,
			});

			// Enrich results with snippets from R2 (only when there's a text query)
			const bucket = getBucket();
			const workspaceId = getWorkspaceId();
			const enriched = await Promise.all(
				result.results.map(async (r) => {
					if (!query) return r;
					try {
						const note = await readNote(bucket, workspaceId, r.path);
						if (note) {
							const snippet = extractSnippet(note.body, query);
							if (snippet) return { ...r, snippet };
						}
					} catch {}
					return r;
				}),
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							results: enriched,
							total: result.total,
							cursor: result.cursor,
						}),
					},
				],
			};
		},
	);
}
