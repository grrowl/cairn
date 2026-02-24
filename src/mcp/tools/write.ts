import { z } from "zod";
import { writeNote } from "../../storage/notes";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NoteMetadata } from "../../storage/workspace-index";

export const writeSchema = {
	path: z.string().describe("Note path e.g. 'entities/person/jamie'"),
	content: z.string().describe("Full markdown body. May include YAML frontmatter."),
	tags: z.array(z.string()).optional().describe("Tags to set (merged with any in frontmatter)"),
	aliases: z.array(z.string()).optional().describe("Alternative names that resolve backlinks to this note"),
};

export function registerWriteTool(
	server: McpServer,
	getBucket: () => R2Bucket,
	getWorkspaceId: () => string,
	getIndex: () => DurableObjectStub,
) {
	server.tool(
		"cairn_write",
		"Create or overwrite a note. Frontmatter in content is parsed and merged with explicit params. WikiLinks in content are automatically indexed. Aliases allow this note to be found when other notes link using those names.",
		writeSchema,
		async ({ path, content, tags, aliases }) => {
			const bucket = getBucket();
			const workspaceId = getWorkspaceId();

			const result = await writeNote(bucket, workspaceId, path, content, { tags, aliases });

			// Update the index
			const index = getIndex();
			const metadata: NoteMetadata = {
				title: result.frontmatter.title || path,
				type: result.frontmatter.type || "",
				tags: result.frontmatter.tags || [],
				aliases: result.frontmatter.aliases || [],
				links: result.links.map((l) => ({ target: l.target, context: l.context })),
				created: result.frontmatter.created || new Date().toISOString(),
				modified: result.frontmatter.modified || new Date().toISOString(),
			};
			await (index as any).noteUpdated(path, metadata);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							path: result.path,
							created: result.created,
							links_found: result.links.length,
						}),
					},
				],
			};
		},
	);
}
