import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { GoogleHandler } from "./google-handler";
import type { Props } from "./utils";

export { WorkspaceIndex } from "./storage/workspace-index";

export class CairnMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Cairn",
		version: "0.1.0",
	});

	async init() {
		this.server.tool("cairn_ping", "Check that the Cairn MCP server is running", {}, async () => ({
			content: [
				{
					type: "text",
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

// Wrap CairnMCP.serve() to inject workspaceId from X-Workspace-Id header into props
const mcpServe = CairnMCP.serve("/mcp");

const wrappedMcpHandler = {
	async fetch(request: Request, env: Env, ctx: any) {
		const workspaceId = request.headers.get("X-Workspace-Id") || "default";
		if (ctx.props) {
			ctx.props.workspaceId = workspaceId;
		}
		return mcpServe.fetch(request, env, ctx);
	},
};

const provider = new OAuthProvider({
	apiHandler: wrappedMcpHandler as any,
	apiRoute: "/mcp",
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

// Custom fetch handler: rewrite /{workspaceId}/mcp to /mcp + X-Workspace-Id header
// so OAuthProvider's prefix-based apiRoute matching works.
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Match /{workspaceId}/mcp paths
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
