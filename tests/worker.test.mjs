import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';

const origin = 'http://127.0.0.1:8793';
const redirect = 'http://localhost:8989/callback';
const verifier = 'diagnostic-verifier-with-at-least-forty-three-characters-123456789';
const base64url = value => Buffer.from(value).toString('base64url');
let mf;
let alice;
let bob;
let sequence = 0;
async function dispatch(path, options = {}) { return mf.dispatchFetch(origin + path, { redirect: "manual", ...options, headers: { Host: new URL(origin).host, ...options.headers } }); }
async function issue(email, { legacy = false, resource = origin } = {}) {
  const registered = await dispatch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Integration test', redirect_uris: [redirect], token_endpoint_auth_method: 'none' }) });
  assert.equal(registered.status, 201, await registered.clone().text());
  const { client_id } = await registered.json();
  const query = new URLSearchParams({ client_id, response_type: 'code', redirect_uri: redirect, scope: 'openid email profile', state: 'test-state', code_challenge: base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))), code_challenge_method: 'S256' });
  if (resource) query.set('resource', resource);
  const completed = await dispatch('/__test/complete', { method: 'POST', body: JSON.stringify({ authorizeUrl: origin + '/authorize?' + query, email, legacy }) });
  assert.equal(completed.status, 200, await completed.clone().text());
  const { redirectTo } = await completed.json();
  const code = new URL(redirectTo).searchParams.get('code');
  const response = await dispatch(legacy ? '/__test/legacy-token' : '/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id, code, redirect_uri: redirect, code_verifier: verifier, ...(resource ? { resource } : {}) }) });
  assert.equal(response.status, 200, await response.clone().text());
  return { ...await response.json(), client_id };
}
const modernMeta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'Cairn integration test', version: '1.0.0' }, 'io.modelcontextprotocol/clientCapabilities': {} };
async function rpc(token, method, params = {}, { path = '/alice-private/mcp', version = '2026-07-28' } = {}) {
  const response = await dispatch(path, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': version, 'Mcp-Method': method, ...(params.name ? { 'Mcp-Name': params.name } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, params: { ...params, ...(version === '2026-07-28' ? { _meta: modernMeta } : {}) } }) });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { const line = text.split('\n').find(line => line.startsWith('data: ')); body = line ? JSON.parse(line.slice(6)) : text; }
  return { response, body };
}

before(async () => {
  const bundle = await build({ entryPoints: ['tests/fixtures/worker.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral', target: 'es2023', conditions: ['workerd', 'worker', 'browser'], mainFields: ['browser', 'module', 'main'], external: ['node:*', 'cloudflare:*'], logLevel: 'silent' });
  mf = new Miniflare(convertV4MiniflareOptions({ name: "cairn-tests", modules: [{ type: 'ESModule', path: process.cwd() + '/tests/generated-worker.mjs', contents: bundle.outputFiles[0].text }], compatibilityDate: '2026-10-30', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'], kvNamespaces: ['OAUTH_KV'], r2Buckets: ['BUCKET'], durableObjects: { MCP_OBJECT: { className: 'CairnMCP', useSQLite: true }, WORKSPACE_INDEX: { className: 'WorkspaceIndex', useSQLite: true } }, outboundService: async request => {
    const url = new URL(request.url);
    if (url.hostname === 'oauth2.googleapis.com' && url.pathname === '/token') return Response.json({ access_token: 'mock-google-access-token' });
    if (url.hostname === 'openidconnect.googleapis.com' && url.pathname === '/v1/userinfo') return Response.json({ sub: 'test-user', email: 'alice@example.test', name: 'Alice', email_verified: true });
    return new Response('Unexpected outbound request', { status: 502 });
  }, bindings: { GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test', COOKIE_ENCRYPTION_KEY: 'test-only-consent-secret-at-least-thirty-two-characters', ADMIN_EMAIL: 'admin@example.test', REDIRECT_LEGACY_DOMAIN: 'true' }, log: new Log(LogLevel.ERROR) }));
  const bucket = await mf.getR2Bucket('BUCKET');
  for (const [id, email] of [['alice-private', 'alice@example.test'], ['bob-private', 'bob@example.test']]) {
    await bucket.put('_system/workspaces/' + id + '.json', JSON.stringify({ id, name: id, created_by: email, created_at: new Date().toISOString(), members: [{ email, role: 'owner', added_at: new Date().toISOString() }], settings: { timezone: 'Australia/Melbourne' } }));
  }
  alice = await issue('alice@example.test');
  bob = await issue('bob@example.test');
});
after(async () => { await mf?.dispose(); });

test('workspace discovery advertises a canonical application resource and CIMD', async () => {
  const response = await dispatch('/alice-private/mcp');
  assert.equal(response.status, 401);
  assert.match(response.headers.get('www-authenticate'), /resource_metadata=/);
  const metadata = await (await dispatch('/.well-known/oauth-protected-resource')).json();
  assert.equal(metadata.resource, origin);
  const as = await (await dispatch('/.well-known/oauth-authorization-server')).json();
  assert.equal(as.client_id_metadata_document_supported, true);
  assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
});

test('modern discovery and all eight tools work repeatedly without a session', async () => {
  for (let index = 0; index < 5; index++) {
    const discovered = await rpc(alice.access_token, 'server/discover');
    assert.equal(discovered.response.status, 200, JSON.stringify(discovered.body));
    assert.equal(discovered.body.error, undefined, JSON.stringify(discovered.body));
    const listed = await rpc(alice.access_token, 'tools/list');
    assert.equal(listed.response.status, 200, JSON.stringify(listed.body));
    assert.equal(listed.body.result.tools.length, 8);
    assert.equal(listed.response.headers.get('mcp-session-id'), null);
  }
});

test('legacy initialize and tool listing remain supported', async () => {
  const initialized = await rpc(alice.access_token, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy', version: '1' } }, { version: '2025-11-25' });
  assert.equal(initialized.response.status, 200, JSON.stringify(initialized.body));
  const listed = await rpc(alice.access_token, 'tools/list', {}, { version: '2025-11-25' });
  assert.equal(listed.response.status, 200, JSON.stringify(listed.body));
  assert.equal(listed.body.result.tools.length, 8);
});

test('membership is enforced on every workspace and ignores spoofed routing headers', async () => {
  const denied = await rpc(bob.access_token, 'tools/list');
  assert.equal(denied.response.status, 403);
  const response = await dispatch('/alice-private/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + bob.access_token, 'Content-Type': 'application/json', 'X-Workspace-Id': 'bob-private' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  assert.equal(response.status, 403);
  const missing = await rpc(alice.access_token, 'tools/list', {}, { path: '/not-a-workspace/mcp' });
  assert.equal(missing.response.status, 404);
});

test('notes, frontmatter, indexes and links remain isolated across concurrent requests', async () => {
  const writes = await Promise.all([
    rpc(alice.access_token, 'tools/call', { name: 'cairn_write', arguments: { path: 'hello', content: '---\ntitle: Alice note\ntags: [test]\n---\nHello [[linked]]' } }),
    rpc(bob.access_token, 'tools/call', { name: 'cairn_write', arguments: { path: 'hello', content: '---\ntitle: Bob note\n---\nPrivate Bob content' } }, { path: '/bob-private/mcp' }),
  ]);
  for (const write of writes) { assert.equal(write.response.status, 200, JSON.stringify(write.body)); assert.equal(write.body.result?.isError, undefined, JSON.stringify(write.body)); }
  const reads = await Promise.all([
    rpc(alice.access_token, 'tools/call', { name: 'cairn_read', arguments: { path: 'hello' } }),
    rpc(bob.access_token, 'tools/call', { name: 'cairn_read', arguments: { path: 'hello' } }, { path: '/bob-private/mcp' }),
  ]);
  assert.match(JSON.stringify(reads[0].body), /Alice note/);
  assert.doesNotMatch(JSON.stringify(reads[0].body), /Private Bob content/);
  assert.match(JSON.stringify(reads[1].body), /Private Bob content/);
  const listed = await rpc(alice.access_token, 'tools/call', { name: 'cairn_list', arguments: {} });
  assert.match(JSON.stringify(listed.body), /hello/);
  const links = await rpc(alice.access_token, 'tools/call', { name: 'cairn_links', arguments: { path: 'hello' } });
  assert.match(JSON.stringify(links.body), /linked/);
});

test('browser workspace API works with the same application token', async () => {
  const response = await dispatch('/api/workspaces/alice-private', { headers: { Authorization: 'Bearer ' + alice.access_token } });
  assert.equal(response.status, 200, await response.clone().text());
});

test('legacy 0.2.3 refresh tokens survive the upgrade and bind to the canonical resource', async () => {
  for (const resource of [origin, undefined]) {
    const old = await issue('alice@example.test', { legacy: true, resource: resource === undefined ? '' : resource });
    const response = await dispatch('/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: old.client_id, refresh_token: old.refresh_token }) });
    assert.equal(response.status, 200, await response.clone().text());
    const refreshed = await response.json();
    const listed = await rpc(refreshed.access_token, 'tools/list');
    assert.equal(listed.response.status, 200, JSON.stringify(listed.body));
    assert.equal(listed.body.result.tools.length, 8);
  }
});

test('legacy tokens bound to obsolete workspace audiences require a clean reauthorization', async () => {
  const old = await issue('alice@example.test', { legacy: true, resource: origin + '/alice-private/mcp' });
  const response = await dispatch('/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: old.client_id, refresh_token: old.refresh_token, resource: origin + '/alice-private/mcp' }) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_grant');
});

test('OAuth consent cannot be approved from a different browser', async () => {
  const registered = await dispatch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'CSRF test', redirect_uris: [redirect], token_endpoint_auth_method: 'none' }) });
  const { client_id } = await registered.json();
  const query = new URLSearchParams({ client_id, response_type: 'code', redirect_uri: redirect, resource: origin, code_challenge: base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))), code_challenge_method: 'S256' });
  const consent = await dispatch('/authorize?' + query);
  assert.equal(consent.status, 200);
  const html = await consent.text();
  const handle = html.match(/name="handle" value="([^"]+)"/)[1];
  const response = await dispatch('/authorize', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ handle, decision: 'approve' }) });
  assert.equal(response.status, 400);
});


test('browser consent, Google callback and PKCE token exchange work end to end', async () => {
  const registered = await dispatch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Cairn browser', redirect_uris: [origin + '/'], token_endpoint_auth_method: 'none' }) });
  const { client_id } = await registered.json();
  const query = new URLSearchParams({ client_id, response_type: 'code', redirect_uri: origin + '/', scope: 'openid email profile', resource: origin, state: 'browser-state', code_challenge: base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))), code_challenge_method: 'S256' });
  const consent = await dispatch('/authorize?' + query);
  assert.equal(consent.status, 200);
  const handle = (await consent.text()).match(/name="handle" value="([^"]+)"/)[1];
  const cookie = consent.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const approved = await dispatch('/authorize', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie }, body: new URLSearchParams({ handle, decision: 'approve' }) });
  assert.equal(approved.status, 302, await approved.clone().text());
  const google = new URL(approved.headers.get('location'));
  assert.equal(google.origin, 'https://accounts.google.com');
  assert.equal(google.searchParams.get('redirect_uri'), origin + '/callback');
  assert.match(google.searchParams.get('scope'), /openid/);
  const callback = await dispatch('/callback?' + new URLSearchParams({ state: google.searchParams.get('state'), code: 'mock-google-code' }), { headers: { Cookie: approved.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') } });
  assert.equal(callback.status, 302, await callback.clone().text());
  const returned = new URL(callback.headers.get('location'));
  assert.equal(returned.searchParams.get('state'), 'browser-state');
  assert.equal(returned.searchParams.get('iss'), origin);
  const token = await dispatch('/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id, code: returned.searchParams.get('code'), code_verifier: verifier, resource: origin, redirect_uri: origin + '/' }) });
  assert.equal(token.status, 200, await token.clone().text());
  const { access_token } = await token.json();
  const listed = await rpc(access_token, 'tools/list');
  assert.equal(listed.response.status, 200, JSON.stringify(listed.body));
  assert.equal(listed.body.result.tools.length, 8);
  const replay = await dispatch('/authorize', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie }, body: new URLSearchParams({ handle, decision: 'approve' }) });
  assert.equal(replay.status, 400);
});

test('patch, search, daily notes, deletion and ZIP export work through the new transport', async () => {
  const call = async (name, args) => {
    const result = await rpc(alice.access_token, 'tools/call', { name, arguments: args });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.notEqual(result.body.result?.isError, true, JSON.stringify(result.body));
    return result.body;
  };
  await call('cairn_write', { path: 'upgrade-cycle', content: 'Unique upgrade lifecycle marker' });
  await call('cairn_patch', { path: 'upgrade-cycle', op: 'append', content: '\nAppended searchable content' });
  const patched = await call('cairn_read', { path: 'upgrade-cycle' });
  assert.match(JSON.stringify(patched), /Appended searchable content/);
  const search = await call('cairn_search', { query: 'upgrade' });
  assert.match(JSON.stringify(search), /upgrade-cycle/);
  await call('cairn_daily', { date: '2026-10-30', op: 'append', content: 'Daily upgrade check' });
  const daily = await call('cairn_daily', { date: '2026-10-30', op: 'read' });
  assert.match(JSON.stringify(daily), /Daily upgrade check/);
  const zip = await dispatch('/api/workspaces/alice-private/export.zip', { headers: { Authorization: 'Bearer ' + alice.access_token } });
  assert.equal(zip.status, 200);
  assert.match(zip.headers.get('content-type'), /zip/);
  assert.ok((await zip.arrayBuffer()).byteLength > 0);
  await call('cairn_delete', { path: 'upgrade-cycle' });
  const gone = await call('cairn_search', { query: 'upgrade' });
  assert.doesNotMatch(JSON.stringify(gone), /upgrade-cycle/);
});

test('legacy tool requests tolerate a session header left over from the previous deployment', async () => {
  const response = await dispatch('/alice-private/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + alice.access_token, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', 'Mcp-Session-Id': 'old-session-from-previous-deployment' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) });
  assert.equal(response.status, 200, await response.clone().text());
});

test('browser requests from an untrusted origin cannot access the MCP endpoint', async () => {
  const response = await dispatch('/alice-private/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + alice.access_token, 'Content-Type': 'application/json', Origin: 'https://evil.test', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) });
  assert.equal(response.status, 403);
});
