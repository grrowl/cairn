import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { SCRIPT } from '../src/frontend/script.ts';

function browser({ search = '', flow, tokenResponse = { access_token: 'test-access-token' } } = {}) {
  const memory = new Map(flow ? [['cairn_oauth', JSON.stringify(flow)]] : []);
  const local = new Map([['cairn_client_id', 'browser-client']]);
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) });
  const app = { innerHTML: '', insertAdjacentHTML(_where, text) { this.innerHTML += text; } };
  const nodes = { app, 'header-right': { innerHTML: '' } };
  const handlers = {};
  const requests = [];
  const window = { location: { origin: 'https://cairn.chillidonut.com', pathname: '/', search, hash: '#/login' }, addEventListener: (event, handler) => { handlers[event] = handler; } };
  window.history = { replaceState(_state, _title, url) { const parsed = new URL(url, window.location.origin); Object.assign(window.location, { pathname: parsed.pathname, hash: parsed.hash, search: parsed.search }); } };
  const document = { getElementById: id => nodes[id], createElement: () => ({ set textContent(value) { this.innerHTML = String(value).replaceAll('<', '&lt;'); } }) };
  const fetch = async (path, options) => {
    requests.push({ path, options });
    return Response.json(path === '/token' ? tokenResponse : { workspaces: [] });
  };
  vm.runInNewContext(SCRIPT, { window, document, fetch, crypto, URLSearchParams, TextEncoder, Uint8Array, btoa, sessionStorage: storage(memory), localStorage: storage(local), console });
  return { window, handlers, requests, memory, app };
}

test('browser login generates an S256 PKCE challenge and stores a tab-bound verifier', async () => {
  const b = browser();
  await b.window.__startLogin();
  const url = new URL(b.window.location.href, b.window.location.origin);
  const flow = JSON.parse(b.memory.get('cairn_oauth'));
  const expected = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(flow.verifier))).toString('base64url');
  assert.equal(url.searchParams.get('code_challenge'), expected);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), flow.state);
  assert.equal(url.searchParams.get('resource'), b.window.location.origin);
});

test('browser callback includes its verifier and validates the issuer before using the token', async () => {
  const b = browser({ search: '?code=test-code&state=expected&iss=https%3A%2F%2Fcairn.chillidonut.com', flow: { state: 'expected', verifier: 'tab-verifier', createdAt: Date.now(), returnTo: '#/workspaces/private' } });
  b.handlers.load();
  await new Promise(resolve => setImmediate(resolve));
  const tokenRequest = b.requests.find(request => request.path === '/token');
  assert.equal(tokenRequest.options.body.get('code_verifier'), 'tab-verifier');
  assert.equal(b.memory.get('cairn_token'), 'test-access-token');
  assert.equal(b.memory.has('cairn_oauth'), false);
  assert.equal(b.window.location.hash, '#/workspaces/private');
});

for (const [name, state, issuer] of [['wrong state', 'wrong', 'https://cairn.chillidonut.com'], ['wrong issuer', 'expected', 'https://evil.test']]) {
  test('browser callback rejects ' + name, async () => {
    const b = browser({ search: '?' + new URLSearchParams({ code: 'code', state, iss: issuer }), flow: { state: 'expected', verifier: 'verifier', createdAt: Date.now() } });
    b.handlers.load();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(b.requests.length, 0);
    assert.equal(b.memory.has('cairn_token'), false);
  });
}
