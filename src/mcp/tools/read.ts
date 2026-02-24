import { z } from "zod";
import { readNote } from "../../storage/notes";
import { extractSection } from "../../storage/markdown";
import { serialiseFrontmatter } from "../../storage/frontmatter";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const readSchema = {
	path: z.string().describe("Note path e.g. 'entities/person/jamie' or 'daily/2026-02-24'"),
	section: z.string().optional().describe("Heading text (without # prefix) to extract just that section"),
	metadata_only: z.boolean().optional().describe("Return only frontmatter + backlink list, skip body. Default false."),
};

export function registerReadTool(
	server: McpServer,
	getBucket: () => R2Bucket,
	getWorkspaceId: () => string,
	getIndex: () => DurableObjectStub,
) {
	server.tool(
		"cairn_read",
		"Read a note. Returns frontmatter metadata and markdown body. Use section to extract a specific heading. Use metadata_only to get just frontmatter and backlinks without the body.",
		readSchema,
		async ({ path, section, metadata_only }) => {
			const bucket = getBucket();
			const workspaceId = getWorkspaceId();

			const note = await readNote(bucket, workspaceId, path);
			if (!note) {
				return {
					content: [{ type: "text" as const, text: `not_found: Note '${path}' does not exist` }],
					isError: true,
				};
			}

			if (metadata_only) {
				// Get backlinks from index
				const index = getIndex();
				const linkResult = await (index as any).getLinks(path, 1, "in");
				const backlinks = linkResult.incoming.map((l: any) => l.path);

				const metaOutput = {
					...note.frontmatter,
					backlinks,
				};

				return {
					content: [{ type: "text" as const, text: serialiseFrontmatter(metaOutput, "") }],
				};
			}

			let body = note.body;
			if (section) {
				const extracted = extractSection(note.body, section);
				if (extracted === null) {
					return {
						content: [{ type: "text" as const, text: `not_found: Section '${section}' not found in note '${path}'` }],
						isError: true,
					};
				}
				body = extracted;
			}

			// Get backlinks for display in frontmatter
			const index = getIndex();
			const linkResult = await (index as any).getLinks(path, 1, "in");
			const backlinks = linkResult.incoming.map((l: any) => l.path);

			const outputFm = { ...note.frontmatter, backlinks };
			const output = serialiseFrontmatter(outputFm, body);

			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);
}
