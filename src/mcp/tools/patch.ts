import { z } from "zod";
import { patchNote, PatchError } from "../../storage/notes";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NoteMetadata, WorkspaceIndex } from "../../storage/workspace-index";

export const patchSchema = {
	path: z.string().describe("Note path"),
	op: z.enum(["append", "prepend", "replace", "append_section", "prepend_section"]).describe("Operation type"),
	content: z.string().describe("Content to insert or replacement text"),
	section: z.string().optional().describe("Heading text (without # prefix) for section ops e.g. 'Meetings'"),
	find: z.string().optional().describe("Substring to find for 'replace' op"),
};

export function registerPatchTool(
	server: McpServer,
	getBucket: () => R2Bucket,
	getWorkspaceId: () => string,
	getIndex: () => DurableObjectStub<WorkspaceIndex>,
) {
	server.tool(
		"cairn_patch",
		"Edit a note without rewriting it. Supports append/prepend to the whole note or a specific section, and find-replace. The note must already exist. WikiLinks in new content are automatically indexed.",
		patchSchema,
		async ({ path, op, content, section, find }) => {
			const bucket = getBucket();
			const workspaceId = getWorkspaceId();

			try {
				const result = await patchNote(bucket, workspaceId, path, op, content, section, find);

				// Update index with re-extracted metadata
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

				// Check alias conflicts after patch (aliases may have changed via frontmatter edit)
				const aliases = metadata.aliases;
				if (aliases.length > 0) {
					const conflicts = await index.checkAliasConflicts(path, aliases);
					if (conflicts.length > 0) {
						return {
							content: [{ type: "text" as const, text: `alias_conflict: ${conflicts.join("; ")}. Note content was saved but index not updated.` }],
							isError: true,
						};
					}
				}

				await index.noteUpdated(path, metadata);

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								path: result.path,
								op: result.op,
								bytes_added: result.bytesAdded,
							}),
						},
					],
				};
			} catch (err) {
				if (err instanceof PatchError) {
					return {
						content: [{ type: "text" as const, text: `${err.errorType}: ${err.message}` }],
						isError: true,
					};
				}
				throw err;
			}
		},
	);
}
