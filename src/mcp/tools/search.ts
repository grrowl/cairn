import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const searchSchema = {
	query: z.string().optional().describe("Full-text search query"),
	tags: z.array(z.string()).optional().describe("Filter to notes with all of these tags"),
	path_prefix: z.string().optional().describe("Scope search to a path prefix e.g. 'entities/person'"),
	backlinks_to: z.string().optional().describe("Find all notes that link to this path"),
	modified_since: z.string().optional().describe("ISO date — return only notes modified after this date"),
	limit: z.number().int().optional().describe("Max results per page. Default 20."),
	cursor: z.string().optional().describe("Pagination cursor from previous response"),
};

export function registerSearchTool(
	server: McpServer,
	getIndex: () => DurableObjectStub,
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
			const result = await (index as any).search({
				query,
				tags,
				pathPrefix: path_prefix,
				backlinksTo: backlinks_to,
				modifiedSince: modified_since,
				limit: limit || 20,
				cursor,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							results: result.results,
							total: result.total,
							cursor: result.cursor,
						}),
					},
				],
			};
		},
	);
}
