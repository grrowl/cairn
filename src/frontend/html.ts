// This file exports the frontend HTML as a string.
// In production, this would be generated from index.html at build time.
// For now, we inline it directly.

export const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cairn — Persistent memory for your AI assistants</title>
<meta name="description" content="Shared, structured, back-linked markdown notes accessible to all your AI agents via MCP. WikiLinks, backlinks, daily notes, and full-text search.">
<meta property="og:title" content="Cairn">
<meta property="og:description" content="Persistent, Obsidian-like memory for your AI assistants. Shared knowledge vault via MCP.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://cairn.place">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Cairn">
<meta name="twitter:description" content="Persistent, Obsidian-like memory for your AI assistants. Shared knowledge vault via MCP.">
<meta name="author" content="Tom McKenzie">
<link rel="icon" href="/favicon.ico">
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
header .user-info { font-size: 0.8rem; color: var(--fg2); }
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
.tab.disabled { color: var(--fg-dim); cursor: default; }
.hidden { display: none; }
.copyable { cursor: pointer; padding: 0.15rem 0.4rem; border-radius: 3px; transition: background 0.15s; }
.copyable:hover { background: var(--bg3); }
.copyable.copied { background: var(--success); color: #fff; }
.vault-row { display: flex; align-items: center; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border); cursor: pointer; gap: 1rem; }
.vault-row:last-child { border-bottom: none; }
.vault-row:hover { background: var(--bg3); }
.vault-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; }
.vault-date { flex-shrink: 0; font-size: 0.75rem; color: var(--fg2); }
.file-viewer { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace; font-size: 0.8rem; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; overflow-x: auto; }
.file-viewer .md-h { color: var(--accent); font-weight: 700; }
.file-viewer .md-bold { font-weight: 700; color: var(--fg); }
.file-viewer .md-italic { font-style: italic; color: var(--fg); }
.file-viewer .md-wikilink { color: var(--accent); cursor: pointer; text-decoration: none; }
.file-viewer .md-wikilink:hover { text-decoration: underline; }
.file-viewer .md-link { color: var(--accent); text-decoration: underline; }
.file-viewer .md-hr { color: var(--fg-dim); }
.file-viewer .md-list { color: var(--accent); }
.file-viewer .md-frontmatter { color: var(--fg-dim); }
.file-path { font-family: monospace; font-size: 0.8rem; color: var(--fg2); margin-bottom: 0.75rem; }
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
  let token = null;
  let userEmail = null;
  let userName = null;
  let currentWorkspaceId = null;

  const $ = (id) => document.getElementById(id);
  const app = () => $('app');
  const headerRight = () => $('header-right');

  // Token management
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

  // API calls
  async function api(path, opts = {}) {
    const t = getToken();
    if (!t) { navigate('#/login'); throw new Error('Not authenticated'); }
    const res = await fetch(path, {
      ...opts,
      headers: {
        'Authorization': \`Bearer \${t}\`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) { setToken(null); navigate('#/login'); throw new Error('Unauthorized'); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // Routing
  function navigate(hash) {
    window.location.hash = hash;
  }

  function getRoute() {
    const hash = window.location.hash || '#/';
    return hash.slice(1);
  }

  async function router() {
    const route = getRoute();
    const t = getToken();

    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.has('code')) {
      const code = params.get('code');
      const clientId = localStorage.getItem('cairn_client_id');
      if (clientId) {
        try {
          const res = await fetch('/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              client_id: clientId,
              redirect_uri: window.location.origin + '/',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setToken(data.access_token);
          }
        } catch (e) {
          console.error('Token exchange failed:', e);
        }
      }
      window.history.replaceState({}, '', window.location.pathname + '#/workspaces');
      return router();
    }
    if (params.has('access_token')) {
      setToken(params.get('access_token'));
      window.history.replaceState({}, '', window.location.pathname + '#/workspaces');
      return router();
    }

    if (!t && route !== '/login') {
      navigate('#/login');
      return;
    }

    if (t) {
      headerRight().innerHTML = \`<span class="user-info">\${userEmail || ''}</span> <button class="btn-outline" onclick="window.__logout()">Logout</button>\`;
    } else {
      headerRight().innerHTML = '';
    }

    if (route === '/login') return renderLogin();
    if (route === '/workspaces') return renderWorkspaces();
    const wsFileMatch = route.match(/^\\/workspaces\\/([^/]+)\\/(.+)$/);
    if (wsFileMatch) return renderWorkspaceSettings(wsFileMatch[1], wsFileMatch[2]);
    const wsSettingsMatch = route.match(/^\\/workspaces\\/([^/]+)$/);
    if (wsSettingsMatch) return renderWorkspaceSettings(wsSettingsMatch[1]);
    return renderWorkspaces();
  }

  // OAuth login
  function renderLogin() {
    app().innerHTML = \`
      <div style="text-align:center;padding:3rem 0">
        <h2 style="margin-bottom:1rem">Welcome to Cairn</h2>
        <p style="color:var(--fg2);margin-bottom:2rem">Persistent, Obsidian-like memory for your AI assistants</p>
        <button class="btn" onclick="window.__startLogin()" style="padding:0.75rem 2rem;font-size:1rem">
          Sign in with Google
        </button>
      </div>
    \`;
  }

  async function getOrRegisterClientId() {
    const stored = localStorage.getItem('cairn_client_id');
    if (stored) return stored;
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'cairn-admin',
        redirect_uris: [window.location.origin + '/'],
        token_endpoint_auth_method: 'none',
      }),
    });
    if (!res.ok) throw new Error('Client registration failed');
    const data = await res.json();
    localStorage.setItem('cairn_client_id', data.client_id);
    return data.client_id;
  }

  window.__startLogin = async function() {
    try {
      const clientId = await getOrRegisterClientId();
      const redirectUri = window.location.origin + '/';
      window.location.href = \`/authorize?response_type=code&client_id=\${encodeURIComponent(clientId)}&redirect_uri=\${encodeURIComponent(redirectUri)}&scope=openid+email+profile\`;
    } catch (e) {
      app().innerHTML = \`<div class="error">Login failed: \${escHtml(e.message)}</div>\`;
    }
  };

  window.__logout = function() {
    setToken(null);
    userEmail = null;
    userName = null;
    navigate('#/login');
  };

  // Workspaces list
  async function renderWorkspaces() {
    app().innerHTML = '<div class="loading">Loading workspaces...</div>';
    try {
      const data = await api('/api/workspaces');
      let html = '<h2 style="margin-bottom:1rem">Workspaces</h2>';
      html += \`<div class="form-row" style="margin-bottom:1.5rem">
        <div style="flex:1"><input id="new-ws-name" placeholder="Workspace name (optional)"></div>
        <div><input id="new-ws-id" placeholder="Custom ID (optional)" style="width:200px"></div>
        <button class="btn" onclick="window.__createWorkspace()">Create</button>
      </div>\`;
      html += '<div id="ws-error"></div>';

      if (!data.workspaces || data.workspaces.length === 0) {
        html += '<div class="empty">No workspaces yet. Create one above.</div>';
      } else {
        for (const ws of data.workspaces) {
          html += \`<div class="card" style="cursor:pointer" onclick="window.location.hash='#/workspaces/\${ws.id}'">
            <h3>\${escHtml(ws.name)}</h3>
            <div class="meta">\${ws.id} &middot; \${ws.members.length} member\${ws.members.length !== 1 ? 's' : ''} &middot; Created \${new Date(ws.created_at).toLocaleDateString()}</div>
          </div>\`;
        }
      }
      app().innerHTML = html;
    } catch (e) {
      app().innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`;
    }
  }

  window.__createWorkspace = async function() {
    const name = $('new-ws-name').value.trim();
    const id = $('new-ws-id').value.trim();
    const errDiv = $('ws-error');
    errDiv.innerHTML = '';
    try {
      const body = {};
      if (name) body.name = name;
      if (id) body.id = id;
      await api('/api/workspaces', { method: 'POST', body: JSON.stringify(body) });
      renderWorkspaces();
    } catch (e) {
      errDiv.innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`;
    }
  };

  // Workspace settings
  async function renderWorkspaceSettings(id, filePath) {
    currentWorkspaceId = id;
    app().innerHTML = '<div class="loading">Loading workspace...</div>';
    try {
      const data = await api(\`/api/workspaces/\${id}\`);
      const ws = data.workspace;

      let html = \`<a href="#/workspaces" class="nav-back">&larr; All Workspaces</a>\`;
      html += \`<h2 style="margin-bottom:0.25rem">\${escHtml(ws.name)}</h2>\`;
      const mcpUrl = window.location.origin + '/' + ws.id + '/mcp';
      html += \`<div class="meta" style="margin-bottom:1.5rem">\${ws.id} &middot; MCP endpoint: <code class="copyable" onclick="window.__copy(this)" title="Click to copy">\${mcpUrl}</code></div>\`;

      html += \`<div class="tabs" id="ws-tabs">
        <div class="tab active" onclick="window.__showTab('vault', this)">Vault</div>
        <div class="tab disabled" id="file-tab-btn" onclick="window.__showTab('file', this)">File</div>
        <div class="tab" onclick="window.__showTab('members', this)">Members</div>
        <div class="tab" onclick="window.__showTab('settings', this)">Settings</div>
      </div>\`;

      // Vault tab (active by default)
      html += \`<div id="tab-vault">
        <div id="vault-list" class="loading">Loading notes...</div>
      </div>\`;

      // File tab (hidden until a file is opened)
      html += \`<div id="tab-file" class="hidden"></div>\`;

      // Members tab
      html += \`<div id="tab-members" class="hidden">
        <div class="card">
          <div class="form-row" style="margin-bottom:1rem">
            <input id="invite-email" placeholder="Email address">
            <select id="invite-role" style="width:120px"><option value="member">Member</option><option value="owner">Owner</option></select>
            <button class="btn" onclick="window.__inviteMember('\${ws.id}')">Invite</button>
          </div>
          <div id="invite-msg"></div>
          <div id="members-list">\`;

      for (const m of ws.members) {
        html += \`<div class="member-row">
          <div>\${escHtml(m.email)}<span class="role">\${m.role}</span></div>
          <button class="btn-outline" style="padding:0.25rem 0.5rem;font-size:0.75rem" onclick="window.__removeMember('\${ws.id}','\${escAttr(m.email)}')">Remove</button>
        </div>\`;
      }

      html += \`</div></div></div>\`;

      // Settings tab
      html += \`<div id="tab-settings" class="hidden">
        <div class="card">
          <div class="form-group">
            <label>Workspace Name</label>
            <div class="form-row">
              <input id="ws-name" value="\${escAttr(ws.name)}">
              <button class="btn" onclick="window.__updateWorkspace('\${ws.id}')">Save</button>
            </div>
          </div>
          <div class="form-group">
            <label>Timezone</label>
            <div class="form-row">
              <input id="ws-timezone" value="\${escAttr(ws.settings.timezone)}">
              <button class="btn" onclick="window.__updateTimezone('\${ws.id}')">Save</button>
            </div>
          </div>
        </div>
        <div class="card">
          <h3>Admin Actions</h3>
          <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
            <button class="btn-outline" onclick="window.__rebuildIndex('\${ws.id}')">Rebuild Index</button>
            <button class="btn-danger" onclick="window.__deleteWorkspace('\${ws.id}')">Delete Workspace</button>
          </div>
          <div id="admin-msg" style="margin-top:0.5rem"></div>
        </div>
      </div>\`;

      html += \`<div id="settings-error"></div>\`;
      app().innerHTML = html;

      // Load vault notes
      loadVault(id);

      // If a file path was provided (from URL), open it
      if (filePath) {
        window.__openFile(id, filePath);
      }
    } catch (e) {
      app().innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`;
    }
  }

  async function loadVault(workspaceId) {
    const container = $('vault-list');
    if (!container) return;
    try {
      const data = await api(\`/api/workspaces/\${workspaceId}/notes\`);
      if (!data.notes || data.notes.length === 0) {
        const mcpEndpoint = window.location.origin + '/' + workspaceId + '/mcp';
        container.innerHTML = '<div class="empty">No notes yet.<br>Connect an MCP client to <code class="copyable" onclick="window.__copy(this)" title="Click to copy">' + mcpEndpoint + '</code> to get started.</div>';
        container.classList.remove('loading');
        return;
      }
      let html = '<div class="card" style="padding:0.5rem 0">';
      for (const note of data.notes) {
        const name = escHtml(note.path);
        const date = formatRelativeDate(note.modified);
        html += \`<div class="vault-row" onclick="window.__openFile('\${escAttr(workspaceId)}','\${escAttr(note.path)}')">
          <span class="vault-name" title="\${escAttr(note.path)}">\${name}</span>
          <span class="vault-date">\${date}</span>
        </div>\`;
      }
      html += '</div>';
      container.innerHTML = html;
      container.classList.remove('loading');
    } catch (e) {
      container.innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`;
      container.classList.remove('loading');
    }
  }

  window.__openFile = async function(wsId, path) {
    const fileTab = $('tab-file');
    if (!fileTab) return;
    fileTab.innerHTML = '<div class="loading">Loading file...</div>';

    // Enable the File tab button
    const btn = $('file-tab-btn');
    if (btn) btn.classList.remove('disabled');

    // Switch to File tab
    window.__showTab('file', btn);

    // Update URL without triggering router
    history.replaceState({}, '', '#/workspaces/' + wsId + '/' + path);

    try {
      const data = await api(\`/api/workspaces/\${wsId}/notes/\${path}\`);
      const note = data.note;
      let html = \`<div class="file-path">\${escHtml(note.path)}</div>\`;
      html += \`<div class="file-viewer">\${renderMarkdown(note.body)}</div>\`;
      fileTab.innerHTML = html;
    } catch (e) {
      fileTab.innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`;
    }
  };

  function renderMarkdown(text) {
    // Split into lines and process each
    const lines = text.split('\\n');
    let inFrontmatter = false;
    let frontmatterDone = false;
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Frontmatter detection
      if (i === 0 && line.trim() === '---') {
        inFrontmatter = true;
        result.push('<span class="md-frontmatter">' + escHtml(line) + '</span>');
        continue;
      }
      if (inFrontmatter) {
        result.push('<span class="md-frontmatter">' + escHtml(line) + '</span>');
        if (line.trim() === '---') {
          inFrontmatter = false;
          frontmatterDone = true;
        }
        continue;
      }

      // Headings: lines starting with #
      const headingMatch = line.match(/^(#{1,6}\\s+.*)$/);
      if (headingMatch) {
        result.push('<span class="md-h">' + escHtml(line) + '</span>');
        continue;
      }

      // Horizontal rules
      if (/^(\\s*[-*_]\\s*){3,}$/.test(line)) {
        result.push('<span class="md-hr">' + escHtml(line) + '</span>');
        continue;
      }

      // Process inline formatting
      result.push(processInline(line));
    }

    return result.join('\\n');
  }

  function processInline(line) {
    // Escape HTML first, then apply formatting on the escaped text
    let out = escHtml(line);

    // Bold: **text** or __text__
    out = out.replace(/\\*\\*(.+?)\\*\\*/g, '<span class="md-bold">**$1**</span>');
    out = out.replace(/__(.+?)__/g, '<span class="md-bold">__$1__</span>');

    // Italic: *text* or _text_ (but not inside bold markers)
    out = out.replace(/(?<!\\*)\\*(?!\\*)(.+?)(?<!\\*)\\*(?!\\*)/g, '<span class="md-italic">*$1*</span>');
    out = out.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<span class="md-italic">_$1_</span>');

    // WikiLinks: [[target]] or [[target|display]]
    out = out.replace(/\\[\\[([^\\]|]+?)(?:\\|([^\\]]+?))?\\]\\]/g, function(match, target, display) {
      const wsId = currentWorkspaceId || '';
      return '<a class="md-wikilink" href="#" onclick="window.__openFile(\\'' + escAttr(wsId) + '\\',\\'' + escAttr(target) + '\\');return false">[[' + (display || target) + ']]</a>';
    });

    // Markdown links: [text](url)
    out = out.replace(/\\[([^\\]]+?)\\]\\(([^)]+?)\\)/g, function(match, text, url) {
      return '<a class="md-link" href="' + url + '" target="_blank" rel="noopener">[' + text + '](' + url + ')</a>';
    });

    // List markers: - or * at start of line
    out = out.replace(/^(\\s*)([-*+])\\s/, '$1<span class="md-list">$2</span> ');

    return out;
  }

  function formatRelativeDate(isoStr) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    return date.toLocaleDateString();
  }

  window.__showTab = function(tabId, el) {
    document.querySelectorAll('[id^="tab-"]').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabEl = $(\`tab-\${tabId}\`);
    if (tabEl) tabEl.classList.remove('hidden');
    if (el) el.classList.add('active');

    // Update URL when switching away from file tab
    if (tabId !== 'file' && currentWorkspaceId) {
      history.replaceState({}, '', '#/workspaces/' + currentWorkspaceId);
    }
  };

  window.__updateWorkspace = async function(id) {
    try {
      await api(\`/api/workspaces/\${id}\`, { method: 'PUT', body: JSON.stringify({ name: $('ws-name').value }) });
      renderWorkspaceSettings(id);
    } catch (e) { $('settings-error').innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`; }
  };

  window.__updateTimezone = async function(id) {
    try {
      await api(\`/api/workspaces/\${id}\`, { method: 'PUT', body: JSON.stringify({ settings: { timezone: $('ws-timezone').value } }) });
      renderWorkspaceSettings(id);
    } catch (e) { $('settings-error').innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`; }
  };

  window.__inviteMember = async function(wsId) {
    const email = $('invite-email').value.trim();
    const role = $('invite-role').value;
    if (!email) return;
    try {
      await api(\`/api/workspaces/\${wsId}/members\`, { method: 'POST', body: JSON.stringify({ email, role }) });
      $('invite-email').value = '';
      renderWorkspaceSettings(wsId);
    } catch (e) { $('invite-msg').innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`; }
  };

  window.__removeMember = async function(wsId, email) {
    if (!confirm(\`Remove \${email} from this workspace?\`)) return;
    try {
      await api(\`/api/workspaces/\${wsId}/members/\${encodeURIComponent(email)}\`, { method: 'DELETE' });
      renderWorkspaceSettings(wsId);
    } catch (e) { $('settings-error').innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`; }
  };

  window.__rebuildIndex = async function(wsId) {
    const msg = $('admin-msg');
    msg.innerHTML = '<span style="color:var(--fg2)">Rebuilding index...</span>';
    try {
      await api(\`/api/workspaces/\${wsId}/rebuild-index\`, { method: 'POST' });
      async function poll() {
        try {
          const result = await api(\`/api/workspaces/\${wsId}/rebuild-index\`);
          if (result.status === 'rebuilding') {
            msg.innerHTML = \`<span style="color:var(--fg2)">Rebuilding... \${result.notes_indexed} notes indexed</span>\`;
            setTimeout(poll, 1000);
          } else {
            msg.innerHTML = \`<div class="success">Index rebuilt: \${result.notes_indexed} notes indexed\${result.errors ? \` (\${result.errors} errors)\` : ''}</div>\`;
          }
        } catch (e) { msg.innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`; }
      }
      setTimeout(poll, 500);
    } catch (e) { msg.innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`; }
  };

  window.__copy = function(el) {
    navigator.clipboard.writeText(el.textContent).then(() => {
      el.classList.add('copied');
      const orig = el.textContent;
      el.textContent = 'Copied!';
      setTimeout(() => { el.classList.remove('copied'); el.textContent = orig; }, 1200);
    });
  };

  window.__deleteWorkspace = async function(wsId) {
    if (!confirm(\`Delete workspace "\${wsId}"? This will delete ALL notes and cannot be undone.\`)) return;
    try {
      await api(\`/api/workspaces/\${wsId}\`, { method: 'DELETE' });
      navigate('#/workspaces');
    } catch (e) { $('admin-msg').innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`; }
  };

  // Utilities
  function escHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  // Init
  window.addEventListener('hashchange', router);
  window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('code')) {
      // OAuth callback handled by router
    }
    router();
  });
})();
</script>
</body>
</html>
`;
