// Test-only authentication fixture. This file is never a production entrypoint.
import worker, { oauthOptions } from "../../src/index";
import { getOAuthApi } from "@cloudflare/workers-oauth-provider";
import LegacyOAuthProvider from "workers-oauth-provider-legacy";
export { CairnMCP, WorkspaceIndex } from "../../src/index";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/__test/complete") {
      const input = await request.json<{ authorizeUrl: string; email: string; legacy?: boolean }>();
      const props = { email: input.email, name: input.email };
      if (input.legacy) {
        const legacy = new LegacyOAuthProvider({
          apiRoute: "/api/", apiHandler: { fetch: () => new Response("ok") },
          authorizeEndpoint: "/authorize", tokenEndpoint: "/token",
          defaultHandler: { async fetch(req: Request, rawBindings: unknown) {
            const bindings = rawBindings as Env & { OAUTH_PROVIDER: import("workers-oauth-provider-legacy").OAuthHelpers };
            const parsed = await bindings.OAUTH_PROVIDER.parseAuthRequest(req);
            const result = await bindings.OAUTH_PROVIDER.completeAuthorization({ request: parsed, userId: "test-user", metadata: {}, scope: parsed.scope, props });
            return Response.json(result);
          } },
        });
        return legacy.fetch(new Request(input.authorizeUrl), { ...env }, ctx);
      }
      const oauth = getOAuthApi(oauthOptions(new URL(input.authorizeUrl)), env);
      const parsed = await oauth.parseAuthRequest(new Request(input.authorizeUrl));
      return Response.json(await oauth.completeAuthorization({ request: parsed, userId: "test-user", metadata: {}, scope: parsed.scope, props }));
    }
    if (url.pathname === "/__test/legacy-token") {
      const legacy = new LegacyOAuthProvider({
        apiRoute: "/api/", apiHandler: { fetch: () => new Response("ok") },
        authorizeEndpoint: "/authorize", tokenEndpoint: "/token", defaultHandler: { fetch: () => new Response("not found", { status: 404 }) },
      });
      return legacy.fetch(new Request(url.origin + "/token", request), { ...env }, ctx);
    }
    return worker.fetch(request, env, ctx);
  },
};
