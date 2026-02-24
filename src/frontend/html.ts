// This file exports the frontend HTML as a string.
// In production, this would be generated from index.html at build time.
// For now, we inline it directly.

export const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cairn</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #1a1b1e; --bg2: #25262b; --bg3: #2c2e33;
  --fg: #c1c2c5; --fg2: #909296; --fg-dim: #5c5f66;
  --accent: #339af0; --accent-hover: #228be6;
  --danger: #e03131; --success: #2f9e44;
  --border: #373a40; --radius: 6px;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.5; min-height: 100vh; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
button { cursor: pointer; font-family: inherit; font-size: 0.875rem; border: none; border-radius: var(--radius); padding: 0.5rem 1rem; transition: background 0.15s; }
.btn { background: var(--accent); color: #fff; }
.btn:hover { background: var(--accent-hover); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { background: #c92a2a; }
.btn-outline { background: transparent; border: 1px solid var(--border); color: var(--fg); }
.btn-outline:hover { background: var(--bg3); }
input, select { font-family: inherit; font-size: 0.875rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.5rem 0.75rem; width: 100%; }
input:focus, select:focus { outline: none; border-color: var(--accent); }
.container { max-width: 720px; margin: 0 auto; padding: 2rem 1rem; }
header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; margin-bottom: 2rem; border-bottom: 1px solid var(--border); }
header h1 { font-size: 1.25rem; font-weight: 600; }
header .user-info { font-size: 0.8rem; color: var(--fg2); margin-right: 0.75rem; }
.card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1rem; }
.card h3 { margin-bottom: 0.5rem; font-size: 1rem; }
.card .meta { font-size: 0.8rem; color: var(--fg2); }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.8rem; color: var(--fg2); margin-bottom: 0.25rem; }
.form-row { display: flex; gap: 0.5rem; align-items: flex-end; }
.member-row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
.member-row:last-child { border-bottom: none; }
.member-row .role { font-size: 0.75rem; color: var(--fg2); background: var(--bg3); padding: 0.15rem 0.5rem; border-radius: 3px; margin-left: 0.5rem; }
.empty { text-align: center; color: var(--fg-dim); padding: 2rem; }
.error { color: var(--danger); font-size: 0.85rem; margin-top: 0.5rem; }
.success { color: var(--success); font-size: 0.85rem; margin-top: 0.5rem; }
.loading { text-align: center; color: var(--fg2); padding: 2rem; }
.nav-back { font-size: 0.85rem; margin-bottom: 1rem; display: inline-block; }
.tabs { display: flex; gap: 0; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
.tab { padding: 0.5rem 1rem; font-size: 0.85rem; color: var(--fg2); cursor: pointer; border-bottom: 2px solid transparent; }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.hidden { display: none; }
.copyable { cursor: pointer; padding: 0.15rem 0.4rem; border-radius: 3px; transition: background 0.15s; }
.copyable:hover { background: var(--bg3); }
.copyable.copied { background: var(--success); color: #fff; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1><a href="#/" style="color:var(--fg)">Cairn</a></h1>
    <div id="header-right"></div>
  </header>
  <div id="app"></div>
</div>
<script>
(function() {
  var token = null;
  var userEmail = null;

  var $ = function(id) { return document.getElementById(id); };
  var app = function() { return $('app'); };
  var headerRight = function() { return $('header-right'); };

  function getToken() {
    if (token) return token;
    token = sessionStorage.getItem('cairn_token');
    return token;
  }

  function setToken(t) {
    token = t;
    if (t) sessionStorage.setItem('cairn_token', t);
    else sessionStorage.removeItem('cairn_token');
  }

  function api(path, opts) {
    opts = opts || {};
    var t = getToken();
    if (!t) { navigate('#/login'); return Promise.reject(new Error('Not authenticated')); }
    return fetch(path, Object.assign({}, opts, {
      headers: Object.assign({ 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' }, opts.headers || {}),
    })).then(function(res) {
      if (res.status === 401) { setToken(null); navigate('#/login'); throw new Error('Unauthorized'); }
      return res.json().then(function(data) {
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  }

  function navigate(hash) { window.location.hash = hash; }

  function getRoute() {
    var hash = window.location.hash || '#/';
    return hash.slice(1);
  }

  function escHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  async function router() {
    var route = getRoute();
    var t = getToken();

    var params = new URLSearchParams(window.location.search);
    if (params.has('code')) {
      var code = params.get('code');
      var clientId = localStorage.getItem('cairn_client_id');
      if (clientId) {
        try {
          var res = await fetch('/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'authorization_code', code: code, client_id: clientId, redirect_uri: window.location.origin + '/' }),
          });
          if (res.ok) { var data = await res.json(); setToken(data.access_token); }
        } catch (e) { console.error('Token exchange failed:', e); }
      }
      window.history.replaceState({}, '', window.location.pathname + '#/workspaces');
      return router();
    }
    if (params.has('access_token')) {
      setToken(params.get('access_token'));
      window.history.replaceState({}, '', window.location.pathname + '#/workspaces');
      return router();
    }

    if (!t && route !== '/login') { navigate('#/login'); return; }
    if (t) {
      headerRight().innerHTML = '<span class="user-info">' + escHtml(userEmail || '') + '</span> <button class="btn-outline" onclick="window.__logout()">Logout</button>';
    } else {
      headerRight().innerHTML = '';
    }

    if (route === '/login') return renderLogin();
    if (route === '/workspaces') return renderWorkspaces();
    var wsMatch = route.match(/^\\/workspaces\\/([^/]+)$/);
    if (wsMatch) return renderWorkspaceSettings(wsMatch[1]);
    renderWorkspaces();
  }

  function renderLogin() {
    app().innerHTML = '<div style="text-align:center;padding:3rem 0"><h2 style="margin-bottom:1rem">Welcome to Cairn</h2><p style="color:var(--fg2);margin-bottom:2rem">A markdown-first knowledge base with MCP interface</p><button class="btn" onclick="window.__startLogin()" style="padding:0.75rem 2rem;font-size:1rem">Sign in with Google</button></div>';
  }

  function getOrRegisterClientId() {
    var stored = localStorage.getItem('cairn_client_id');
    if (stored) return Promise.resolve(stored);
    return fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'cairn-admin', redirect_uris: [window.location.origin + '/'], token_endpoint_auth_method: 'none' }),
    }).then(function(res) {
      if (!res.ok) throw new Error('Client registration failed');
      return res.json();
    }).then(function(data) {
      localStorage.setItem('cairn_client_id', data.client_id);
      return data.client_id;
    });
  }

  window.__startLogin = function() {
    getOrRegisterClientId().then(function(clientId) {
      var redirectUri = window.location.origin + '/';
      window.location.href = '/authorize?response_type=code&client_id=' + encodeURIComponent(clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=openid+email+profile';
    }).catch(function(e) {
      app().innerHTML = '<div class="error">Login failed: ' + escHtml(e.message) + '</div>';
    });
  };

  window.__logout = function() { setToken(null); userEmail = null; navigate('#/login'); };

  function renderWorkspaces() {
    app().innerHTML = '<div class="loading">Loading workspaces...</div>';
    api('/api/workspaces').then(function(data) {
      var html = '<h2 style="margin-bottom:1rem">Workspaces</h2>';
      html += '<div class="form-row" style="margin-bottom:1.5rem"><div style="flex:1"><input id="new-ws-name" placeholder="Workspace name (optional)"></div><div><input id="new-ws-id" placeholder="Custom ID (optional)" style="width:200px"></div><button class="btn" onclick="window.__createWorkspace()">Create</button></div>';
      html += '<div id="ws-error"></div>';
      if (!data.workspaces || data.workspaces.length === 0) {
        html += '<div class="empty">No workspaces yet. Create one above.</div>';
      } else {
        data.workspaces.forEach(function(ws) {
          html += '<div class="card" style="cursor:pointer" onclick="window.location.hash=\\'#/workspaces/' + ws.id + '\\'"><h3>' + escHtml(ws.name) + '</h3><div class="meta">' + ws.id + ' &middot; ' + ws.members.length + ' member' + (ws.members.length !== 1 ? 's' : '') + ' &middot; Created ' + new Date(ws.created_at).toLocaleDateString() + '</div></div>';
        });
      }
      app().innerHTML = html;
    }).catch(function(e) { app().innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
  }

  window.__createWorkspace = function() {
    var name = $('new-ws-name').value.trim();
    var id = $('new-ws-id').value.trim();
    var errDiv = $('ws-error');
    errDiv.innerHTML = '';
    var body = {};
    if (name) body.name = name;
    if (id) body.id = id;
    api('/api/workspaces', { method: 'POST', body: JSON.stringify(body) }).then(function() {
      renderWorkspaces();
    }).catch(function(e) {
      errDiv.innerHTML = '<div class="error">' + escHtml(e.message) + '</div>';
    });
  };

  function renderWorkspaceSettings(id) {
    app().innerHTML = '<div class="loading">Loading workspace...</div>';
    api('/api/workspaces/' + id).then(function(data) {
      var ws = data.workspace;
      var html = '<a href="#/workspaces" class="nav-back">&larr; All Workspaces</a>';
      html += '<h2 style="margin-bottom:0.25rem">' + escHtml(ws.name) + '</h2>';
      var mcpUrl = window.location.origin + '/' + ws.id + '/mcp';
      html += '<div class="meta" style="margin-bottom:1.5rem">' + ws.id + ' &middot; MCP endpoint: <code class="copyable" onclick="window.__copy(this)" title="Click to copy">' + mcpUrl + '</code></div>';

      html += '<div class="tabs"><div class="tab active" data-tab="settings" onclick="window.__showTab(\\'settings\\', this)">Settings</div><div class="tab" data-tab="members" onclick="window.__showTab(\\'members\\', this)">Members</div></div>';

      // Settings tab
      html += '<div id="tab-settings">';
      html += '<div class="card"><div class="form-group"><label>Workspace Name</label><div class="form-row"><input id="ws-name" value="' + escAttr(ws.name) + '"><button class="btn" onclick="window.__updateWorkspace(\\'' + ws.id + '\\')">Save</button></div></div>';
      html += '<div class="form-group"><label>Timezone</label><div class="form-row"><input id="ws-timezone" value="' + escAttr(ws.settings.timezone) + '"><button class="btn" onclick="window.__updateTimezone(\\'' + ws.id + '\\')">Save</button></div></div>';
      html += '<div class="form-group"><label>Entity Types</label><div class="form-row"><input id="ws-entity-types" value="' + escAttr(ws.settings.entity_types.join(', ')) + '"><button class="btn" onclick="window.__updateEntityTypes(\\'' + ws.id + '\\')">Save</button></div></div></div>';
      html += '<div class="card"><h3>Admin Actions</h3><div style="display:flex;gap:0.5rem;margin-top:0.5rem"><button class="btn-outline" onclick="window.__rebuildIndex(\\'' + ws.id + '\\')">Rebuild Index</button><button class="btn-danger" onclick="window.__deleteWorkspace(\\'' + ws.id + '\\')">Delete Workspace</button></div><div id="admin-msg" style="margin-top:0.5rem"></div></div>';
      html += '</div>';

      // Members tab
      html += '<div id="tab-members" class="hidden"><div class="card">';
      html += '<div class="form-row" style="margin-bottom:1rem"><input id="invite-email" placeholder="Email address"><select id="invite-role" style="width:120px"><option value="member">Member</option><option value="owner">Owner</option></select><button class="btn" onclick="window.__inviteMember(\\'' + ws.id + '\\')">Invite</button></div>';
      html += '<div id="invite-msg"></div>';
      ws.members.forEach(function(m) {
        html += '<div class="member-row"><div>' + escHtml(m.email) + '<span class="role">' + m.role + '</span></div><button class="btn-outline" style="padding:0.25rem 0.5rem;font-size:0.75rem" onclick="window.__removeMember(\\'' + ws.id + '\\',\\'' + escAttr(m.email) + '\\')">Remove</button></div>';
      });
      html += '</div></div>';

      html += '<div id="settings-error"></div>';
      app().innerHTML = html;
    }).catch(function(e) { app().innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
  }

  window.__showTab = function(tabId, el) {
    document.querySelectorAll('[id^="tab-"]').forEach(function(e) { e.classList.add('hidden'); });
    document.querySelectorAll('.tab').forEach(function(e) { e.classList.remove('active'); });
    var tabEl = $('tab-' + tabId);
    if (tabEl) tabEl.classList.remove('hidden');
    if (el) el.classList.add('active');
  };

  window.__updateWorkspace = function(id) {
    api('/api/workspaces/' + id, { method: 'PUT', body: JSON.stringify({ name: $('ws-name').value }) }).then(function() { renderWorkspaceSettings(id); }).catch(function(e) { $('settings-error').innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
  };

  window.__updateTimezone = function(id) {
    api('/api/workspaces/' + id, { method: 'PUT', body: JSON.stringify({ settings: { timezone: $('ws-timezone').value } }) }).then(function() { renderWorkspaceSettings(id); }).catch(function(e) { $('settings-error').innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
  };

  window.__updateEntityTypes = function(id) {
    var types = $('ws-entity-types').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
    api('/api/workspaces/' + id, { method: 'PUT', body: JSON.stringify({ settings: { entity_types: types } }) }).then(function() { renderWorkspaceSettings(id); }).catch(function(e) { $('settings-error').innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
  };

  window.__inviteMember = function(wsId) {
    var email = $('invite-email').value.trim();
    var role = $('invite-role').value;
    if (!email) return;
    api('/api/workspaces/' + wsId + '/members', { method: 'POST', body: JSON.stringify({ email: email, role: role }) }).then(function() { $('invite-email').value = ''; renderWorkspaceSettings(wsId); }).catch(function(e) { $('invite-msg').innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
  };

  window.__removeMember = function(wsId, email) {
    if (!confirm('Remove ' + email + ' from this workspace?')) return;
    api('/api/workspaces/' + wsId + '/members/' + encodeURIComponent(email), { method: 'DELETE' }).then(function() { renderWorkspaceSettings(wsId); }).catch(function(e) { $('settings-error').innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
  };

  window.__rebuildIndex = function(wsId) {
    var msg = $('admin-msg');
    msg.innerHTML = '<span style="color:var(--fg2)">Rebuilding index...</span>';
    api('/api/workspaces/' + wsId + '/rebuild-index', { method: 'POST' }).then(function() {
      function poll() {
        api('/api/workspaces/' + wsId + '/rebuild-index').then(function(result) {
          if (result.status === 'rebuilding') {
            msg.innerHTML = '<span style="color:var(--fg2)">Rebuilding... ' + result.notes_indexed + ' notes indexed</span>';
            setTimeout(poll, 1000);
          } else {
            msg.innerHTML = '<div class="success">Index rebuilt: ' + result.notes_indexed + ' notes indexed' + (result.errors ? ' (' + result.errors + ' errors)' : '') + '</div>';
          }
        }).catch(function(e) { msg.innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
      }
      setTimeout(poll, 500);
    }).catch(function(e) { msg.innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
  };

  window.__copy = function(el) {
    navigator.clipboard.writeText(el.textContent).then(function() {
      el.classList.add('copied');
      var orig = el.textContent;
      el.textContent = 'Copied!';
      setTimeout(function() { el.classList.remove('copied'); el.textContent = orig; }, 1200);
    });
  };

  window.__deleteWorkspace = function(wsId) {
    if (!confirm('Delete workspace "' + wsId + '"? This will delete ALL notes and cannot be undone.')) return;
    api('/api/workspaces/' + wsId, { method: 'DELETE' }).then(function() { navigate('#/workspaces'); }).catch(function(e) { $('admin-msg').innerHTML = '<div class="error">' + escHtml(e.message) + '</div>'; });
  };

  window.addEventListener('hashchange', router);
  window.addEventListener('load', router);
})();
</script>
</body>
</html>`;
