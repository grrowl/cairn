import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { GoogleHandler } from "./google-handler";
import type { Props } from "./utils";
import { registerReadTool } from "./mcp/tools/read";
import { registerWriteTool } from "./mcp/tools/write";
import { registerListTool } from "./mcp/tools/list";
import { registerDailyTool } from "./mcp/tools/daily";
import { registerPatchTool } from "./mcp/tools/patch";
import { registerDeleteTool } from "./mcp/tools/delete";
import { registerSearchTool } from "./mcp/tools/search";
import { registerLinksTool } from "./mcp/tools/links";
import { workspaceRoutes } from "./workspaces/routes";
import { getWorkspaceMetadata, checkMembership } from "./workspaces/membership";
import type { WorkspaceIndex } from "./storage/workspace-index";

export { WorkspaceIndex } from "./storage/workspace-index";

export class CairnMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Cairn",
		version: "0.1.0",
	});

	private getWorkspaceIndex(): DurableObjectStub<WorkspaceIndex> {
		const workspaceId = this.props?.workspaceId || "default";
		const id = this.env.WORKSPACE_INDEX.idFromName(workspaceId);
		return this.env.WORKSPACE_INDEX.get(id);
	}

	async init() {
		const getBucket = () => this.env.BUCKET;
		const getWorkspaceId = () => this.props?.workspaceId || "default";
		const getIndex = () => this.getWorkspaceIndex();
		// Timezone: load from workspace metadata, fallback to UTC
		let cachedTimezone = "Australia/Melbourne";
		const workspaceId = getWorkspaceId();
		if (workspaceId !== "default") {
			try {
				const ws = await getWorkspaceMetadata(this.env.BUCKET, workspaceId);
				if (ws?.settings?.timezone) {
					cachedTimezone = ws.settings.timezone;
				}
			} catch {}
		}
		const getTimezone = () => cachedTimezone;

		// Register all 8 MCP tools + ping
		registerReadTool(this.server, getBucket, getWorkspaceId, getIndex);
		registerWriteTool(this.server, getBucket, getWorkspaceId, getIndex);
		registerListTool(this.server, getIndex);
		registerDailyTool(this.server, getBucket, getWorkspaceId, getIndex, getTimezone);
		registerPatchTool(this.server, getBucket, getWorkspaceId, getIndex);
		registerDeleteTool(this.server, getBucket, getWorkspaceId, getIndex);
		registerSearchTool(this.server, getIndex, getBucket, getWorkspaceId);
		registerLinksTool(this.server, getIndex);

		this.server.tool("cairn_ping", "Check that the Cairn MCP server is running", {}, async () => ({
			content: [
				{
					type: "text" as const,
					text: JSON.stringify({
						status: "ok",
						timestamp: new Date().toISOString(),
						user: this.props?.email,
						workspace: this.props?.workspaceId,
					}),
				},
			],
		}));
	}
}

// CairnMCP serve handler for MCP requests
const mcpServe = CairnMCP.serve("/mcp");

// Combined API handler: routes both MCP and REST API requests.
// Both go through OAuthProvider token validation.
const apiHandler = {
	async fetch(request: Request, env: Env, ctx: any) {
		const url = new URL(request.url);
		const props = ctx.props as Props | undefined;

		if (url.pathname.startsWith("/mcp")) {
			// MCP request — inject workspaceId from header
			const workspaceId = request.headers.get("X-Workspace-Id") || "default";
			if (props) {
				props.workspaceId = workspaceId;
			}

			// Membership check for MCP requests
			if (workspaceId !== "default") {
				const workspace = await getWorkspaceMetadata(env.BUCKET, workspaceId);
				if (!workspace) {
					return new Response(JSON.stringify({ error: "Workspace not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}
				const email = props?.email || "";
				const { authorized } = checkMembership(workspace, email, env.ADMIN_EMAIL);
				if (!authorized) {
					return new Response(JSON.stringify({ error: "Not a member of this workspace" }), {
						status: 403,
						headers: { "Content-Type": "application/json" },
					});
				}
			}

			return mcpServe.fetch(request, env, ctx);
		}

		if (url.pathname.startsWith("/api/")) {
			// REST API request — inject auth context into Hono middleware
			const email = props?.email || "";
			const name = props?.name || "";

			// Clone request and add auth context via headers for Hono middleware
			const apiRequest = new Request(request.url, request);

			// Use Hono's middleware to inject auth context
			const honoApp = workspaceRoutes;
			// Set auth context via a custom mechanism
			const response = await honoApp.fetch(
				apiRequest,
				{ ...env, __auth: { email, name } } as any,
				ctx,
			);
			return response;
		}

		return new Response("Not found", { status: 404 });
	},
};

const provider = new OAuthProvider({
	apiHandler: apiHandler as any,
	apiRoute: ["/mcp", "/api/"],
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: GoogleHandler as any,
	tokenEndpoint: "/token",
});

const RESERVED_PATHS = new Set([
	"authorize",
	"callback",
	"token",
	"register",
	"api",
	"mcp",
	".well-known",
]);

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Match /{workspaceId}/mcp paths and rewrite to /mcp + header
		const mcpMatch = url.pathname.match(/^\/([a-z0-9][a-z0-9_-]*)\/mcp(\/.*)?$/);
		if (mcpMatch && !RESERVED_PATHS.has(mcpMatch[1])) {
			const workspaceId = mcpMatch[1];
			const rest = mcpMatch[2] || "";
			url.pathname = `/mcp${rest}`;

			const headers = new Headers(request.headers);
			headers.set("X-Workspace-Id", workspaceId);

			const rewrittenRequest = new Request(url.toString(), {
				method: request.method,
				headers,
				body: request.body,
			});
			return provider.fetch(rewrittenRequest, env, ctx);
		}

		return provider.fetch(request, env, ctx);
	},
};
