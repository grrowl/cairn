export const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Premium Dark Mode Palette */
  --bg: #0A0A0B;
  --bg-surface: rgba(24, 24, 27, 0.6);
  --bg-surface-hover: rgba(39, 39, 42, 0.8);
  --bg-glass: rgba(24, 24, 27, 0.4);
  
  --fg: #FAFAFA;
  --fg-mutated: #A1A1AA;
  --fg-dim: #71717A;
  
  --accent: #3B82F6;
  --accent-hover: #60A5FA;
  --accent-glow: rgba(59, 130, 246, 0.3);
  
  --danger: #EF4444;
  --danger-hover: #F87171;
  --success: #10B981;
  
  --border: rgba(255, 255, 255, 0.08);
  --border-focus: rgba(59, 130, 246, 0.5);
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 16px;
  --shadow-sm: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-glass: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background-color: var(--bg);
  background-image: 
    radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
    radial-gradient(at 50% 0%, hsla(225,39%,30%,0.1) 0, transparent 50%), 
    radial-gradient(at 100% 0%, hsla(339,49%,30%,0.05) 0, transparent 50%);
  background-attachment: fixed;
  color: var(--fg);
  line-height: 1.6;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); text-decoration: none; transition: var(--transition); }
a:hover { color: var(--accent-hover); }

/* Buttons */
button {
  cursor: pointer;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.6rem 1.2rem;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 0 0 0 var(--accent-glow);
}
.btn:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 12px 0 var(--accent-glow);
  transform: translateY(-1px);
}
.btn:active { transform: translateY(0); }

.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { background: var(--danger-hover); transform: translateY(-1px); }

.btn-outline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--fg);
  backdrop-filter: blur(8px);
}
.btn-outline:hover {
  background: var(--bg-surface-hover);
  border-color: var(--fg-mutated);
}

/* Forms */
input, select {
  font-family: inherit;
  font-size: 0.875rem;
  background: var(--bg-surface);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.6rem 1rem;
  width: 100%;
  transition: var(--transition);
  backdrop-filter: blur(4px);
}
input:focus, select:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 2px var(--accent-glow);
  background: rgba(24, 24, 27, 0.8);
}

.form-group { margin-bottom: 1.25rem; }
.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-mutated);
  margin-bottom: 0.5rem;
}
.form-row { display: flex; gap: 0.75rem; align-items: flex-start; }

/* Layout & Structure */
.container { max-width: 768px; margin: 0 auto; padding: 2rem 1.5rem; }

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0 2rem 0;
  margin-bottom: 2.5rem;
  border-bottom: 1px solid var(--border);
}
header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
header h1 a { color: var(--fg); }
header h1 a:hover { color: var(--accent); }
header .user-info { font-size: 0.875rem; color: var(--fg-mutated); margin-right: 1rem; }

/* Responsive Media Queries */
@media (max-width: 600px) {
  .form-row {
    flex-wrap: wrap;
  }
  .form-row > * {
    flex: 1 1 100%;
  }
  .form-row > button {
    width: 100%;
    margin-top: 0.5rem;
  }
  .form-row > select, .form-row > input {
    width: 100% !important;
  }
}

/* Surface Cards */
.card {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}
.card.clickable:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glass);
}
.card h3 {
  margin-bottom: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--fg);
}
.card .meta { font-size: 0.875rem; color: var(--fg-mutated); }

/* Workspace Vault specific styling */
.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
}
.member-row:last-child { border-bottom: none; }
.member-row .role {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-mutated);
  background: var(--bg-surface);
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  margin-left: 0.75rem;
  border: 1px solid var(--border);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.vault-row {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  gap: 1rem;
  transition: var(--transition);
  border-radius: var(--radius-sm);
  margin: 0.25rem 0;
}
.vault-row:last-child { border-bottom: none; }
.vault-row:hover { background: var(--bg-surface-hover); }
.vault-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.95rem;
  font-weight: 500;
}
.vault-date { flex-shrink: 0; font-size: 0.8rem; color: var(--fg-mutated); }

/* Tabs */
.tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--border);
}
.tab {
  padding: 0.75rem 0.5rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--fg-mutated);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: var(--transition);
  position: relative;
  bottom: -1px;
}
.tab:hover:not(.disabled) { color: var(--fg); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab.disabled { color: var(--fg-dim); cursor: not-allowed; opacity: 0.5; }

/* Utilities */
.hidden { display: none !important; }
.empty { text-align: center; color: var(--fg-mutated); padding: 3rem 1rem; }
.error { color: var(--danger); font-size: 0.875rem; padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm); margin-top: 0.75rem; border: 1px solid rgba(239, 68, 68, 0.2); }
.success { color: var(--success); font-size: 0.875rem; padding: 0.75rem; background: rgba(16, 185, 129, 0.1); border-radius: var(--radius-sm); margin-top: 0.75rem; border: 1px solid rgba(16, 185, 129, 0.2); }
.loading { text-align: center; color: var(--fg-mutated); padding: 3rem; font-weight: 500; }
.loading::after {
  content: "...";
  animation: dots 1.5s steps(5, end) infinite;
}
@keyframes dots {
  0%, 20% { color: transparent; text-shadow: .25em 0 0 transparent, .5em 0 0 transparent; }
  40% { color: var(--fg-mutated); text-shadow: .25em 0 0 transparent, .5em 0 0 transparent; }
  60% { text-shadow: .25em 0 0 var(--fg-mutated), .5em 0 0 transparent; }
  80%, 100% { text-shadow: .25em 0 0 var(--fg-mutated), .5em 0 0 var(--fg-mutated); }
}

.nav-back {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--fg-mutated);
}
.nav-back:hover { color: var(--fg); transform: translateX(-2px); }

.copyable {
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 0.85em;
  transition: var(--transition);
}
.copyable:hover { background: var(--bg-surface-hover); border-color: var(--fg-mutated); }
.copyable.copied { background: var(--success); border-color: var(--success); color: #fff; }

/* Code / Note Viewer */
.file-viewer {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
  box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
}
.file-viewer .md-h { color: var(--accent); font-weight: 700; margin-top: 1rem; display: inline-block; }
.file-viewer .md-bold { font-weight: 700; color: var(--fg); }
.file-viewer .md-italic { font-style: italic; color: var(--fg); }
.file-viewer .md-wikilink {
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
  background: rgba(59, 130, 246, 0.1);
  padding: 0 0.2rem;
  border-radius: 4px;
}
.file-viewer .md-wikilink:hover { background: rgba(59, 130, 246, 0.2); }
.file-viewer .md-link { color: var(--accent); text-decoration: underline; }
.file-viewer .md-hr { color: var(--border); border-top: 1px solid var(--border); display: block; margin: 1rem 0; width: 100%; height: 0; }
.file-viewer .md-list { color: var(--accent); font-weight: bold; }
.file-viewer .md-frontmatter { color: var(--fg-dim); }

.file-path {
  font-family: 'SF Mono', monospace;
  font-size: 0.85rem;
  color: var(--fg-mutated);
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  display: inline-block;
}

.file-meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
  background: var(--bg-glass);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
}
.file-meta-key { color: var(--fg-mutated); font-weight: 500; }
.file-meta-val { color: var(--fg); font-family: 'SF Mono', monospace; }
`;
