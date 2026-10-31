import { z } from "zod";
import { deleteNote } from "../../storage/notes";
import type { McpServer } from "@modelcontextprotocol/server";
import type { WorkspaceIndex } from "../../storage/workspace-index";

export const deleteSchema = {
	path: z.string().describe("Note path to delete"),
};

export function registerDeleteTool(
	server: McpServer,
	getBucket: () => R2Bucket,
	getWorkspaceId: () => string,
	getIndex: () => DurableObjectStub<WorkspaceIndex>,
) {
	server.registerTool(
		"cairn_delete",
		{ description: "Delete a note. Also removes this note from the backlink index. Does not modify the content of other notes that reference this one.", inputSchema: z.object(deleteSchema), annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false } },
		async ({ path }) => {
			const bucket = getBucket();
			const workspaceId = getWorkspaceId();

			const deleted = await deleteNote(bucket, workspaceId, path);
			if (!deleted) {
				return {
					content: [{ type: "text" as const, text: `not_found: Note '${path}' does not exist` }],
					isError: true,
				};
			}

			// Remove from index
			const index = getIndex();
			await index.noteDeleted(path);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ deleted: path }),
					},
				],
			};
		},
	);
}
