export const SCRIPT = `
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
      <div style="text-align:center;padding:4rem 0">
        <h2 style="margin-bottom:1rem;font-size:2rem;font-weight:700">Welcome to cairn</h2>
        <p style="color:var(--fg-dim);margin-bottom:2.5rem;font-size:1.1rem">Shared graph knowledge vault for your agents</p>
        <button class="btn" onclick="window.__startLogin()" style="padding:0.75rem 2.5rem;font-size:1.1rem;margin-bottom:4rem">
          Sign in with Google
        </button>
        
        <div style="text-align:left; max-width: 600px; margin: 0 auto; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem;">
          <h3 style="margin-bottom: 1.5rem; font-size: 1.25rem;">How it works</h3>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div>
              <h4 style="color: var(--accent); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <span style="background: rgba(59, 130, 246, 0.2); color: var(--accent); width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">1</span>
                Create a Vault
              </h4>
              <p style="color: var(--fg-mutated); font-size: 0.95rem;">Sign in and create a shared workspace for your agents. You'll get a unique MCP endpoint URL.</p>
            </div>
            <div>
              <h4 style="color: var(--accent); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <span style="background: rgba(59, 130, 246, 0.2); color: var(--accent); width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">2</span>
                Connect your AI
              </h4>
              <p style="color: var(--fg-mutated); font-size: 0.95rem;">Add the endpoint to Claude Code, Desktop, Cursor, or any MCP-compatible client. Your agents can now read and write to your shared vault.</p>
            </div>
            <div>
              <h4 style="color: var(--accent); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <span style="background: rgba(59, 130, 246, 0.2); color: var(--accent); width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">3</span>
                Share Memory
              </h4>
              <p style="color: var(--fg-mutated); font-size: 0.95rem;">All notes are saved as structured Markdown files. Your agents can cross-reference, backlink, and build shared knowledge seamlessly.</p>
            </div>
          </div>
        </div>
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
        client_name: 'cairn',
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
      let html = '<h2 style="margin-bottom:1.5rem">Your Workspaces</h2>';
      html += \`<div class="form-row" style="margin-bottom:2rem; align-items: stretch">
        <div style="flex:1"><input id="new-ws-name" placeholder="Workspace name (optional)"></div>
        <div><input id="new-ws-id" placeholder="Custom ID (optional)" style="width:200px"></div>
        <button class="btn" onclick="window.__createWorkspace()">Create Workspace</button>
      </div>\`;
      html += '<div id="ws-error"></div>';

      if (!data.workspaces || data.workspaces.length === 0) {
        html += '<div class="empty">No workspaces yet. Create one above to get started.</div>';
      } else {
        html += '<div style="display: grid; gap: 1rem">';
        for (const ws of data.workspaces) {
          const firstEmail = ws.members.length > 0 ? ws.members[0].email : '';
          const othersCount = ws.members.length - 1;
          const membersText = firstEmail + (othersCount > 0 ? ' + ' + othersCount + ' more' : '');
          html += \`<div class="card clickable" onclick="window.location.hash='#/workspaces/\${ws.id}'">
            <h3>\${escHtml(ws.name)}</h3>
            <div class="meta">\${escHtml(membersText)} &middot; Created \${new Date(ws.created_at).toLocaleDateString()}</div>
          </div>\`;
        }
        html += '</div>';
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

      let html = \`<a href="#/workspaces" class="nav-back">&larr; Back to Workspaces</a>\`;
      html += \`<h2 style="margin-bottom:0.5rem;font-size:1.75rem">\${escHtml(ws.name)}</h2>\`;
      const mcpUrl = window.location.origin + '/' + ws.id + '/mcp';
      const exportUrl = '/api/workspaces/' + ws.id + '/export.zip';
      html += \`<div class="meta" style="margin-bottom:2rem;color:var(--fg-dim)">
        Workspace ID: \${ws.id} &middot; MCP endpoint: <code class="copyable" onclick="window.__copy(this)" title="Click to copy">\${mcpUrl}</code>
        &middot; <a href="#" onclick="window.__downloadZip('\${escAttr(ws.id)}');return false" style="font-size:0.8rem">Download ZIP</a>
      </div>\`;

      html += \`<div class="tabs" id="ws-tabs">
        <div class="tab active" onclick="window.__showTab('vault', this)">Vault</div>
        <div class="tab disabled" id="file-tab-btn" onclick="window.__showTab('file', this)">File</div>
        <div class="tab" onclick="window.__showTab('members', this)">Members</div>
        <div class="tab" onclick="window.__showTab('settings', this)">Settings</div>
      </div>\`;

      // Vault tab
      html += \`<div id="tab-vault">
        <div id="vault-list" class="loading">Loading notes...</div>
      </div>\`;

      // File tab
      html += \`<div id="tab-file" class="hidden"></div>\`;

      // Members tab
      html += \`<div id="tab-members" class="hidden">
        <div class="card" style="margin-bottom: 0">
          <h3 style="margin-bottom: 1rem">Manage Access</h3>
          <div class="form-row" style="margin-bottom:1.5rem">
            <input id="invite-email" placeholder="Email address" style="flex:1">
            <select id="invite-role" style="width:140px">
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <button class="btn" onclick="window.__inviteMember('\${ws.id}')">Invite User</button>
          </div>
          <div id="invite-msg"></div>
          
          <div id="members-list" style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
          <h4 style="font-size: 0.85rem; color: var(--fg-mutated); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em">Current Members</h4>\`;

      for (const m of ws.members) {
        html += \`<div class="member-row">
          <div style="display:flex;align-items:center;">
            <span style="font-weight:500">\${escHtml(m.email)}</span>
            <span class="role">\${m.role}</span>
          </div>
          <button class="btn-outline" style="padding:0.4rem 0.75rem;font-size:0.75rem" onclick="window.__removeMember('\${ws.id}','\${escAttr(m.email)}')">Remove</button>
        </div>\`;
      }

      html += \`</div></div></div>\`;

      // Settings tab
      html += \`<div id="tab-settings" class="hidden">
        <div class="card">
          <h3 style="margin-bottom: 1rem">General Settings</h3>
          <div class="form-group">
            <label>Workspace Name</label>
            <div class="form-row">
              <input id="ws-name" value="\${escAttr(ws.name)}" style="flex:1">
              <button class="btn" onclick="window.__updateWorkspace('\${ws.id}')">Save Changes</button>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Timezone (For Daily Notes)</label>
            <div class="form-row">
              <input id="ws-timezone" value="\${escAttr(ws.settings.timezone)}" style="flex:1">
              <button class="btn" onclick="window.__updateTimezone('\${ws.id}')">Save Changes</button>
            </div>
          </div>
        </div>
        
        <div class="card" style="border-color: rgba(239, 68, 68, 0.3)">
          <h3 style="color: var(--danger); margin-bottom: 1rem">Danger Zone</h3>
          <p style="font-size: 0.875rem; color: var(--fg-mutated); margin-bottom: 1rem">
            Rebuilding the index may take a while. Deleting the workspace is irreversible.
          </p>
          <div style="display:flex;gap:1rem;">
            <button class="btn-outline" onclick="window.__rebuildIndex('\${ws.id}')">Rebuild Search Index</button>
            <button class="btn-danger" onclick="window.__deleteWorkspace('\${ws.id}')">Delete Workspace</button>
          </div>
          <div id="admin-msg" style="margin-top:1rem"></div>
        </div>
      </div>\`;

      html += \`<div id="settings-error"></div>\`;
      app().innerHTML = html;

      loadVault(id);

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
        container.innerHTML = \`
          <div class="empty" style="border: 2px dashed var(--border); border-radius: var(--radius); background: var(--bg-surface);">
            <div style="font-size: 2rem; margin-bottom: 1rem">🗂️</div>
            <h3 style="color: var(--fg); margin-bottom: 0.5rem">No notes yet</h3>
            <p style="margin-bottom: 1rem">Connect an MCP client to your endpoint to get started.</p>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; text-align: left; max-width: 500px; margin: 0 auto; margin-top: 1rem;">
              <code class="copyable" onclick="window.__copy(this)" title="Click to copy" style="display:block; padding: 0.75rem 1rem; font-size: 0.85rem">claude mcp add --scope project --transport http cairn \${mcpEndpoint}</code>
              <code class="copyable" onclick="window.__copy(this)" title="Click to copy" style="display:block; padding: 0.75rem 1rem; font-size: 0.85rem">npx @cursor/mcp add --http cairn \${mcpEndpoint}</code>
            </div>
          </div>\`;
        container.classList.remove('loading');
        return;
      }
      
      let html = '<div style="display: flex; flex-direction: column; gap: 0.25rem;">';
      for (const note of data.notes) {
        const name = escHtml(note.path);
        const date = formatRelativeDate(note.modified);
        html += \`<div class="vault-row" onclick="window.__openFile('\${escAttr(workspaceId)}','\${escAttr(note.path)}')">
          <svg style="width: 16px; height: 16px; color: var(--accent);" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
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

    const btn = $('file-tab-btn');
    if (btn) btn.classList.remove('disabled');

    window.__showTab('file', btn);
    history.replaceState({}, '', '#/workspaces/' + wsId + '/' + path);

    try {
      const data = await api(\`/api/workspaces/\${wsId}/notes/\${path}\`);
      const note = data.note;
      
      let html = \`
      <div style="background: var(--bg-glass); border-radius: var(--radius); border: 1px solid var(--border); overflow: hidden;">
        <div style="background: var(--bg-surface); padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 0.75rem;">
          <svg style="width: 18px; height: 18px; color: var(--fg-mutated);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span style="font-family: 'SF Mono', monospace; font-size: 0.9rem; color: var(--fg);">\${escHtml(note.path)}</span>
        </div>
        <div style="padding: 1.5rem;">
      \`;
      
      html += renderFrontmatter(note.frontmatter);
      html += \`<div class="file-viewer" style="border: none; background: transparent; padding: 0; box-shadow: none;">\${renderMarkdown(note.body)}</div>\`;
      html += \`</div></div>\`;
      
      fileTab.innerHTML = html;
    } catch (e) {
      fileTab.innerHTML = \`<div class="error">\${escHtml(e.message)}</div>\`;
    }
  };

  function renderFrontmatter(fm) {
    if (!fm || typeof fm !== 'object') return '';
    const keys = Object.keys(fm).filter(k => fm[k] != null && fm[k] !== '');
    if (keys.length === 0) return '';
    let html = '<div class="file-meta">';
    for (const key of keys) {
      const raw = fm[key];
      const display = fmValueDisplay(raw);
      const full = fmValueFull(raw);
      html += \`<div class="file-meta-key">\${escHtml(key)}</div>\`;
      html += \`<div class="file-meta-val" title="\${escAttr(full)}">\${escHtml(display)}</div>\`;
    }
    html += '</div>';
    return html;
  }

  function fmValueDisplay(val) {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ');
    if (val instanceof Date) return val.toISOString();
    return JSON.stringify(val);
  }

  function fmValueFull(val) {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ');
    if (val instanceof Date) return val.toISOString();
    return JSON.stringify(val, null, 2);
  }

  function renderMarkdown(text) {
    const lines = text.split('\\n');
    let inFrontmatter = false;
    let frontmatterDone = false;
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
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
      const headingMatch = line.match(/^(#{1,6}\\s+.*)$/);
      if (headingMatch) {
        result.push('<span class="md-h">' + escHtml(line) + '</span>');
        continue;
      }
      if (/^(\\s*[-*_]\\s*){3,}$/.test(line)) {
        result.push('<span class="md-hr"></span>');
        continue;
      }
      result.push(processInline(line));
    }
    return result.join('\\n');
  }

  function processInline(line) {
    let out = escHtml(line);
    out = out.replace(/\\*\\*(.+?)\\*\\*/g, '<span class="md-bold">**$1**</span>');
    out = out.replace(/__(.+?)__/g, '<span class="md-bold">__$1__</span>');
    out = out.replace(/(?<!\\*)\\*(?!\\*)(.+?)(?<!\\*)\\*(?!\\*)/g, '<span class="md-italic">*$1*</span>');
    out = out.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<span class="md-italic">_$1_</span>');
    out = out.replace(/\\[\\[([^\\]|]+?)(?:\\|([^\\]]+?))?\\]\\]/g, function(match, target, display) {
      const wsId = currentWorkspaceId || '';
      return '<a class="md-wikilink" href="#" onclick="window.__openFile(\\'' + escAttr(wsId) + '\\',\\'' + escAttr(target) + '\\');return false">[[' + (display || target) + ']]</a>';
    });
    out = out.replace(/\\[([^\\]]+?)\\]\\(([^)]+?)\\)/g, function(match, text, url) {
      if (/^(javascript|data|vbscript):/i.test(url.trim())) return match;
      return '<a class="md-link" href="' + escAttr(url) + '" target="_blank" rel="noopener">[' + text + '](' + url + ')</a>';
    });
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
    msg.innerHTML = '<span style="color:var(--fg-mutated)">Rebuilding index...</span>';
    try {
      await api(\`/api/workspaces/\${wsId}/rebuild-index\`, { method: 'POST' });
      async function poll() {
        try {
          const result = await api(\`/api/workspaces/\${wsId}/rebuild-index\`);
          if (result.status === 'rebuilding') {
            msg.innerHTML = \`<span style="color:var(--fg-mutated)">Rebuilding... \${result.notes_indexed} notes indexed</span>\`;
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

  window.__downloadZip = async function(wsId) {
    const t = getToken();
    if (!t) { navigate('#/login'); return; }
    try {
      const res = await fetch(\`/api/workspaces/\${wsId}/export.zip\`, {
        headers: { 'Authorization': \`Bearer \${t}\` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || (wsId + '.zip');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  };

  function escHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  window.addEventListener('hashchange', router);
  window.addEventListener('load', () => { router(); });
})();
`;
