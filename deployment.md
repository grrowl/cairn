# Cairn Deployment Guide

## Domain migration (October 2026)

The existing `cairn` Worker now serves `cairn.chillidonut.com`, using the same
Google credentials, R2 bucket, OAuth KV, and Durable Object namespaces. Existing
vaults are preserved. The new `private` workspace is owned by `tom@chillidonut.com`
and uses normal workspace membership checks; Google sign-in has no email-domain
restriction. Its MCP endpoint is `https://cairn.chillidonut.com/private/mcp`.

`https://cairn.chillidonut.com/callback` is registered on the existing Google web
OAuth client (Google Cloud project `cairn-place`, number `857920827032`). Sign-in
on the new domain was verified in Safari on October 30, 2026. Existing local and
old-domain callback entries remain registered.

`REDIRECT_LEGACY_DOMAIN = "true"` in the Wrangler `vars` configuration enables
permanent redirects from the old domain, preserving paths and query strings.
Reconnect MCP clients using the new endpoint rather than relying on cross-origin
redirects. The old domain can expire without affecting the new domain's login.

## Standards upgrade (0.2.0)

MCP now uses SDK v2 with Agents' stateless handler, supporting both `2026-07-28`
and legacy `2025-11-25` clients. OAuth uses Workers OAuth Provider 1.2.4 with S256
PKCE, CIMD, and compatibility DCR. The browser checks state and issuer and uses
PKCE. Consent and upstream state use the library's single-use, browser-bound
helpers. `COOKIE_ENCRYPTION_KEY` remains the remembered-consent signing secret.

The canonical protected resource is the application origin. The root protected
resource metadata advertises it to clients. Workspace membership still applies on
every MCP and API request. Public workspace URLs remain unchanged and are never
rewritten before token validation.

Existing notes, memberships, indexes, bindings, migration tags and Worker secrets
are retained. Root-bound and previously unbound refresh tokens migrate in place.
Clients with old path-bound grants must authorize once again; the provider returns
`invalid_grant` so conformant clients can recover. Browser sessions may need one
fresh login after deploying the upgrade.

Before deploying, run `npm run check` and `npx wrangler deploy --dry-run`.
The CI workflow runs those checks for PRs and deploys checked main-branch changes.

## Prerequisites

- Node.js 24 or later (CI uses Node.js 26).

- Cloudflare account with **Workers Paid plan** (required for Durable Objects)
- `wrangler` CLI installed and authenticated:
  ```bash
  npm install -g wrangler
  wrangler login
  ```
- Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
  - Create an OAuth 2.0 Client ID (Web application type)
  - Set the authorized redirect URI to `https://<your-worker-domain>/callback`
  - Note the Client ID and Client Secret

## 1. Create Resources

### KV Namespace (OAuth session storage)

```bash
wrangler kv namespace create OAUTH_KV
```

Copy the returned `id` value and update `wrangler.jsonc` line 38:

```jsonc
"kv_namespaces": [
  {
    "binding": "OAUTH_KV",
    "id": "<paste-the-returned-id-here>"
  }
]
```

### R2 Bucket (note storage)

```bash
wrangler r2 bucket create cairn-storage
```

Already configured in `wrangler.jsonc` as `cairn-storage`. No changes needed unless you use a different bucket name.

### Durable Objects

No manual creation needed. `WorkspaceIndex` is created on first access. The historical `CairnMCP` namespace remains bound but new MCP requests use the stateless handler. Existing migration tags remain unchanged.

## 2. Set Secrets

```bash
wrangler secret put GOOGLE_CLIENT_ID
# Paste your Google OAuth Client ID

wrangler secret put GOOGLE_CLIENT_SECRET
# Paste your Google OAuth Client Secret

wrangler secret put COOKIE_ENCRYPTION_KEY
# Paste a random 32+ character string (see below)

wrangler secret put ADMIN_EMAIL
# Paste the Google account email of the platform admin
```

Generate a `COOKIE_ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

The `ADMIN_EMAIL` account gets automatic admin access to all workspaces and can create new workspaces via the admin frontend.

## 3. Deploy

```bash
npm run deploy
```

Or directly:

```bash
wrangler deploy
```

The deploy output will show your worker URL (e.g. `https://cairn.<your-subdomain>.workers.dev`).

## 4. Verify

1. Visit `https://<worker-url>/` -- should show the admin frontend
2. Connect MCP Inspector to `https://<worker-url>/mcp` -- should trigger OAuth flow:
   ```bash
   npx @modelcontextprotocol/inspector
   ```
3. After completing OAuth, verify that all eight tools are listed and `cairn_list` returns your workspace notes.

## Custom Domain (Optional)

To use a custom domain instead of `*.workers.dev`:

1. Add your domain to Cloudflare (DNS must be managed by Cloudflare)
2. Go to Workers & Pages > your worker > Settings > Domains & Routes
3. Add your custom domain
4. Update the Google OAuth redirect URI to `https://<your-custom-domain>/callback`

## GitHub Actions

The repo includes `.github/workflows/deploy.yml` for automatic deploys on push to `main`. The account ID is hardcoded in the workflow.

Required GitHub repository secret:

| Secret | Value |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | API token with "Edit Cloudflare Workers" permissions ([create one here](https://dash.cloudflare.com/profile/api-tokens)) |

GitHub Actions only deploys code. Secrets (`GOOGLE_CLIENT_ID`, etc.) persist across deploys and must be set once via `wrangler secret put`. Resources (KV namespace, R2 bucket) are one-time setup.

## Resource Summary

| Binding | Type | Resource Name | Purpose |
|---------|------|---------------|---------|
| `OAUTH_KV` | KV Namespace | (auto-generated) | OAuth session/token storage |
| `BUCKET` | R2 Bucket | `cairn-storage` | Markdown note content |
| `MCP_OBJECT` | Durable Object | `CairnMCP` | MCP server instances |
| `WORKSPACE_INDEX` | Durable Object | `WorkspaceIndex` | Per-workspace SQLite indexes |
| `GOOGLE_CLIENT_ID` | Secret | -- | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Secret | -- | Google OAuth client secret |
| `COOKIE_ENCRYPTION_KEY` | Secret | -- | Encrypts OAuth approval cookies |
| `ADMIN_EMAIL` | Secret | -- | Platform admin email |
