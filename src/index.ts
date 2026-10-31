import { DurableObject } from "cloudflare:workers";
import OAuthProvider, { type OAuthHelpers, type OAuthProviderOptions } from "@cloudflare/workers-oauth-provider";
import { GoogleHandler } from "./google-handler";
import { legacyRedirect } from "./canonical-url";
import { serveMcp } from "./mcp/server";
import { workspaceRoutes } from "./workspaces/routes";
import { checkMembership, getWorkspaceMetadata } from "./workspaces/membership";
import type { Props } from "./utils";

export { WorkspaceIndex } from "./storage/workspace-index";

// Retain the historical namespace without deleting stored objects. New MCP
// connections are stateless; durable workspace indexes remain in use.
export class CairnMCP extends DurableObject<Env> {}

export function mcpWorkspace(pathname: string): string | undefined {
  if (pathname === "/mcp") return "default";
  return pathname.match(/^\/([a-z0-9][a-z0-9_-]*)\/mcp$/)?.[1];
}

const apiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const props = ctx.props as Props | undefined;
    if (!props?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const workspaceId = mcpWorkspace(url.pathname);
    if (workspaceId !== undefined) {
      if (workspaceId !== "default") {
        const workspace = await getWorkspaceMetadata(env.BUCKET, workspaceId);
        if (!workspace) return Response.json({ error: "Workspace not found" }, { status: 404 });
        if (!checkMembership(workspace, props.email, env.ADMIN_EMAIL).authorized) {
          return Response.json({ error: "Not a member of this workspace" }, { status: 403 });
        }
      }
      return serveMcp(request, env, ctx, workspaceId);
    }
    if (url.pathname.startsWith("/api/")) {
      return workspaceRoutes.fetch(request, { ...env, __auth: { email: props.email, name: props.name } }, ctx);
    }
    return new Response("Not found", { status: 404 });
  },
};

export function oauthOptions(url: URL): OAuthProviderOptions<Env> {
  const workspaceId = mcpWorkspace(url.pathname);
  return {
    apiRoute: ["/mcp", "/api/", ...(workspaceId && workspaceId !== "default" ? [url.pathname] : [])],
    apiHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
    clientIdMetadataDocumentEnabled: true,
    scopesSupported: ["openid", "email", "profile", "offline_access"],
    // One protected application; workspace membership is checked on every call.
    resourceMetadata: { resource: url.origin, resource_name: "Cairn" },
    defaultHandler: GoogleHandler,
    onError({ code, status, internal }) {
      console.warn("oauth_error", { code, status, reason: internal?.reason });
    },
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (env.REDIRECT_LEGACY_DOMAIN === "true") {
      const redirect = legacyRedirect(request.url);
      if (redirect) return redirect;
    }
    const url = new URL(request.url);
    const bindings: Env & { OAUTH_PROVIDER?: OAuthHelpers } = { ...env };
    delete bindings.OAUTH_PROVIDER;
    const provider = new OAuthProvider(oauthOptions(url));
    const started = performance.now();
    // Preserve the public URL through authentication and MCP dispatch.
    const response = await provider.fetch(request, bindings, ctx);
    if (mcpWorkspace(url.pathname) !== undefined) {
      console.log("mcp_request", {
        path: url.pathname,
        method: request.method,
        protocol: request.headers.get("MCP-Protocol-Version"),
        rpcMethod: request.headers.get("Mcp-Method"),
        status: response.status,
        durationMs: Math.round(performance.now() - started),
      });
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
