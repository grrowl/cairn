import { AuthorizationError, CimdFetchError, authorizationErrorRedirect, type AuthRequest, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { FRONTEND_HTML } from "./frontend/html";
import { STYLES } from "./frontend/styles";
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl, type Props } from "./utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

app.onError((error, c) => {
  if (error instanceof AuthorizationError) return c.text(error.description, 400);
  if (error instanceof CimdFetchError) return c.text("The connecting app's identity could not be verified. Please try again.", 502);
  console.error("authentication_failed", { name: error.name, reason: error.message.slice(0, 300) });
  return c.text("Sign-in could not be completed. Please start again.", 500);
});

async function signInWithGoogle(request: Request, env: Env & { OAUTH_PROVIDER: OAuthHelpers }, authRequest: AuthRequest, headers?: Headers) {
  const upstream = await env.OAUTH_PROVIDER.beginUpstream(authRequest, { headers });
  const origin = env.BASE_URL || new URL(request.url).origin;
  upstream.headers.set("Location", getUpstreamAuthorizeUrl({
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: origin + "/callback",
    scope: "openid email profile",
    state: upstream.state,
    upstreamUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  }));
  return new Response(null, { status: 302, headers: upstream.headers });
}

app.get("/authorize", async (c) => {
  const oauth = c.env.OAUTH_PROVIDER;
  let request: AuthRequest;
  try {
    request = await oauth.parseAuthRequest(c.req.raw);
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    throw error;
  }
  if (await oauth.isConsentRemembered(c.req.raw, request, { secret: c.env.COOKIE_ENCRYPTION_KEY })) {
    return signInWithGoogle(c.req.raw, c.env, request);
  }
  const details = await oauth.describeConsent(request);
  const consent = await oauth.beginConsent(request);
  consent.headers.set("Content-Type", "text/html; charset=utf-8");
  const source = details.clientDomain
    ? "Published by " + escapeHtml(details.clientDomain)
    : "This app registered itself; its name is not verified.";
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connect to Cairn</title><style>${STYLES}</style></head>
<body><main class="container"><h1>Connect to Cairn</h1><h2>${escapeHtml(details.clientName)} is requesting access</h2>
<p>${source}</p><p>Allow this app to read and edit Cairn workspaces you belong to. Access will be sent to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
${details.redirectIsLoopback ? "<p>This connects an app on your computer. Continue only if you just started signing in from it.</p>" : ""}
<p>Requested permissions: ${escapeHtml(details.scope.join(", ") || "Cairn workspace access")}</p>
<form method="post" action="/authorize"><input type="hidden" name="handle" value="${escapeHtml(consent.handle)}">
<button class="btn-primary" name="decision" value="approve">Approve</button> <button class="btn-outline" name="decision" value="deny">Cancel</button></form></main></body></html>`, { headers: consent.headers });
});

app.post("/authorize", async (c) => {
  const form = await c.req.formData();
  const handle = String(form.get("handle") || "");
  if (form.get("decision") !== "approve") {
    const denied = await c.env.OAUTH_PROVIDER.denyConsent(c.req.raw, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }
  const approved = await c.env.OAUTH_PROVIDER.approveConsent(c.req.raw, handle, {
    remember: { secret: c.env.COOKIE_ENCRYPTION_KEY },
  });
  return signInWithGoogle(c.req.raw, c.env, approved.request, approved.headers);
});

app.get("/callback", async (c) => {
  const upstream = await c.env.OAUTH_PROVIDER.finishUpstream(c.req.raw);
  if (c.req.query("error")) {
    upstream.headers.set("Location", authorizationErrorRedirect(upstream.request, "access_denied"));
    return new Response(null, { status: 302, headers: upstream.headers });
  }
  const origin = c.env.BASE_URL || new URL(c.req.url).origin;
  const [accessToken, errorResponse] = await fetchUpstreamAuthToken({
    clientId: c.env.GOOGLE_CLIENT_ID,
    clientSecret: c.env.GOOGLE_CLIENT_SECRET,
    code: c.req.query("code"),
    grantType: "authorization_code",
    redirectUri: origin + "/callback",
    upstreamUrl: "https://oauth2.googleapis.com/token",
  });
  if (errorResponse) return errorResponse;
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!response.ok) return c.text("Google could not verify your account. Please start again.", 502);
  const user = await response.json<{ sub?: string; name?: string; email?: string; email_verified?: boolean }>();
  if (!user.sub || !user.email || user.email_verified !== true) return c.text("A verified Google email address is required.", 403);
  const props: Props = { email: user.email, name: user.name || user.email };
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    metadata: { label: props.name },
    props,
    request: upstream.request,
    scope: upstream.request.scope,
    userId: user.sub,
  });
  upstream.headers.set("Location", redirectTo);
  return new Response(null, { status: 302, headers: upstream.headers });
});

app.get("/", (c) => c.html(FRONTEND_HTML));
export { app as GoogleHandler };
