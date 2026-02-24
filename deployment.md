# Cairn Deployment Guide

## Prerequisites

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

No manual creation needed. The `CairnMCP` and `WorkspaceIndex` Durable Objects are created automatically on first access. Migrations are defined in `wrangler.jsonc`.

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
3. After completing OAuth, the `cairn_ping` tool should return status ok

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
