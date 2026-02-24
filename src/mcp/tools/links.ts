import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const linksSchema = {
	path: z.string().describe("Note path"),
	depth: z.number().int().optional().describe("Graph traversal depth. Default 1."),
	direction: z.enum(["in", "out", "both"]).optional().describe("Link direction. Default 'both'."),
};

export function registerLinksTool(
	server: McpServer,
	getIndex: () => DurableObjectStub,
) {
	server.tool(
		"cairn_links",
		"Get backlinks and outgoing links for a note. Useful for understanding context and relationships without reading full documents.",
		linksSchema,
		async ({ path, depth, direction }) => {
			const index = getIndex();
			const result = await (index as any).getLinks(
				path,
				depth || 1,
				direction || "both",
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(result),
					},
				],
			};
		},
	);
}
