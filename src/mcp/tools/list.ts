import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { WorkspaceIndex } from "../../storage/workspace-index";

export const listSchema = {
	path_prefix: z.string().optional().describe("Path prefix to list. Default: root (all notes)."),
	recursive: z.boolean().optional().describe("Include nested paths. Default false."),
	sort: z.enum(["modified", "created", "alpha"]).optional().describe("Sort order. Default 'modified' (most recent first)."),
	limit: z.number().int().optional().describe("Max results per page. Default 20."),
	cursor: z.string().optional().describe("Pagination cursor from previous response"),
};

export function registerListTool(
	server: McpServer,
	getIndex: () => DurableObjectStub<WorkspaceIndex>,
) {
	server.registerTool(
		"cairn_list",
		{ description: "List notes under a path prefix. Returns paths, titles, and modification dates. No content. Supports pagination.", inputSchema: z.object(listSchema), annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
		async ({ path_prefix, recursive, sort, limit, cursor }) => {
			const index = getIndex();
			const result = await index.listNotes({
				pathPrefix: path_prefix,
				recursive: recursive ?? false,
				sort: sort || "modified",
				limit: limit || 20,
				cursor,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							path_prefix: path_prefix || "",
							notes: result.notes,
							total: result.total,
							cursor: result.cursor,
						}),
					},
				],
			};
		},
	);
}
