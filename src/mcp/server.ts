import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { getWorkspaceMetadata } from "../workspaces/membership";
import { registerReadTool } from "./tools/read";
import { registerWriteTool } from "./tools/write";
import { registerListTool } from "./tools/list";
import { registerDailyTool } from "./tools/daily";
import { registerPatchTool } from "./tools/patch";
import { registerDeleteTool } from "./tools/delete";
import { registerSearchTool } from "./tools/search";
import { registerLinksTool } from "./tools/links";

export async function serveMcp(request: Request, env: Env, ctx: ExecutionContext, workspaceId: string) {
  const url = new URL(request.url);
  const workspace = workspaceId === "default" ? null : await getWorkspaceMetadata(env.BUCKET, workspaceId);
  const timezone = workspace?.settings.timezone || "Australia/Melbourne";
  const getIndex = () => env.WORKSPACE_INDEX.get(env.WORKSPACE_INDEX.idFromName(workspaceId));
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "Cairn", version: "0.2.0" });
    registerReadTool(server, () => env.BUCKET, () => workspaceId, getIndex);
    registerWriteTool(server, () => env.BUCKET, () => workspaceId, getIndex);
    registerListTool(server, getIndex);
    registerDailyTool(server, () => env.BUCKET, () => workspaceId, getIndex, () => timezone);
    registerPatchTool(server, () => env.BUCKET, () => workspaceId, getIndex);
    registerDeleteTool(server, () => env.BUCKET, () => workspaceId, getIndex);
    registerSearchTool(server, getIndex, () => env.BUCKET, () => workspaceId);
    registerLinksTool(server, getIndex);
    return server;
  }, {
    route: url.pathname,
    allowedHostnames: [url.hostname],
    allowedOriginHostnames: [url.hostname],
    legacy: "stateless",
  });
  return handler(request, env, ctx);
}
