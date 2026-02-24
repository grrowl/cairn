import { z } from "zod";
import { readNote, writeNote, patchNote, PatchError } from "../../storage/notes";
import { serialiseFrontmatter } from "../../storage/frontmatter";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NoteMetadata } from "../../storage/workspace-index";

export const dailySchema = {
	date: z.string().optional().describe("ISO date e.g. '2026-02-24'. Defaults to today in workspace timezone."),
	op: z.enum(["read", "append", "append_section", "prepend_section"]).describe("Operation. 'read' returns the full note. Others delegate to cairn_patch."),
	content: z.string().optional().describe("Content for append/section ops"),
	section: z.string().optional().describe("Heading text (without # prefix) for section ops"),
};

function getTodayDate(timezone: string): string {
	const now = new Date();
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return formatter.format(now);
}

export function registerDailyTool(
	server: McpServer,
	getBucket: () => R2Bucket,
	getWorkspaceId: () => string,
	getIndex: () => DurableObjectStub,
	getTimezone: () => string,
) {
	server.tool(
		"cairn_daily",
		"Read or append to a daily note. Creates the note with minimal frontmatter if it doesn't exist. Date defaults to today (in workspace timezone).",
		dailySchema,
		async ({ date, op, content, section }) => {
			const bucket = getBucket();
			const workspaceId = getWorkspaceId();
			const timezone = getTimezone();

			const noteDate = date || getTodayDate(timezone);
			const path = `daily/${noteDate}`;

			// Ensure the daily note exists
			const existing = await readNote(bucket, workspaceId, path);
			if (!existing) {
				// Create with frontmatter only
				const now = new Date().toISOString();
				const dailyFrontmatter = {
					title: noteDate,
					type: "daily",
					tags: ["daily"],
					created: now,
					modified: now,
				};
				const initialContent = serialiseFrontmatter(dailyFrontmatter, "\n");

				const result = await writeNote(bucket, workspaceId, path, initialContent);
				const index = getIndex();
				const metadata: NoteMetadata = {
					title: noteDate,
					type: "daily",
					tags: ["daily"],
					aliases: [],
					links: [],
					created: now,
					modified: now,
				};
				await (index as any).noteUpdated(path, metadata);

				if (op === "read") {
					return {
						content: [{ type: "text" as const, text: initialContent }],
					};
				}
			}

			if (op === "read") {
				const note = await readNote(bucket, workspaceId, path);
				if (!note) {
					return {
						content: [{ type: "text" as const, text: `not_found: Daily note '${path}' does not exist` }],
						isError: true,
					};
				}

				// Get backlinks
				const index = getIndex();
				const linkResult = await (index as any).getLinks(path, 1, "in");
				const backlinks = linkResult.incoming.map((l: any) => l.path);
				const outputFm = { ...note.frontmatter, backlinks };
				const output = serialiseFrontmatter(outputFm, note.body);

				return {
					content: [{ type: "text" as const, text: output }],
				};
			}

			// Mutation ops: append, append_section, prepend_section
			if (!content) {
				return {
					content: [{ type: "text" as const, text: `validation_error: '${op}' requires 'content' parameter` }],
					isError: true,
				};
			}

			if ((op === "append_section" || op === "prepend_section") && !section) {
				return {
					content: [{ type: "text" as const, text: `validation_error: '${op}' requires 'section' parameter` }],
					isError: true,
				};
			}

			try {
				const result = await patchNote(bucket, workspaceId, path, op, content, section);

				// Update index
				const index = getIndex();
				const metadata: NoteMetadata = {
					title: result.frontmatter.title || noteDate,
					type: result.frontmatter.type || "daily",
					tags: result.frontmatter.tags || ["daily"],
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
								path,
								op,
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
