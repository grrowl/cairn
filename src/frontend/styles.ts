export const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0C0C0D;
  --bg-surface: rgba(22, 22, 24, 0.8);
  --bg-surface-hover: rgba(34, 34, 37, 0.9);

  --fg: #E8E8EA;
  --fg-muted: #8E8E96;
  --fg-dim: #5A5A62;

  --accent: #C9A96E;
  --accent-hover: #D4B87D;
  --accent-dim: rgba(201, 169, 110, 0.15);

  --link: #7B9EC2;
  --link-hover: #9AB4D1;

  --danger: #D4504C;
  --success: #4A9E6B;

  --border: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(255, 255, 255, 0.15);

  --radius-sm: 6px;
  --radius: 8px;
  --radius-lg: 12px;

  --font-display: 'DM Serif Display', Georgia, serif;
  --font-body: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;

  --transition: all 0.15s ease;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg);
  color: var(--fg);
  line-height: 1.6;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  position: relative;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  opacity: 0.035;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
}

a { color: var(--link); text-decoration: none; transition: var(--transition); }
a:hover { color: var(--link-hover); }

/* Buttons */
button {
  cursor: pointer;
  font-family: var(--font-body);
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
  color: #0C0C0D;
  font-weight: 600;
}
.btn:hover {
  background: var(--accent-hover);
}
.btn:active { opacity: 0.9; }

.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { background: #DA6562; }

.btn-outline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--fg);
}
.btn-outline:hover {
  background: var(--bg-surface-hover);
  border-color: var(--border-hover);
}

/* Login page CTAs */
.cta-group {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 3.5rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.75rem;
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  background: #E8E8EA;
  color: #0C0C0D;
}
.btn-primary:hover { background: #fff; }

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.75rem;
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 500;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg-muted);
  cursor: pointer;
  transition: var(--transition);
}
.btn-ghost:hover {
  border-color: var(--border-hover);
  color: var(--fg);
}

/* Login hero */
.login-hero {
  text-align: center;
  padding: 4rem 0 0;
}

.login-title {
  font-family: var(--font-display);
  font-size: 2.75rem;
  font-weight: 400;
  font-style: italic;
  color: var(--accent);
  line-height: 1.2;
  margin-bottom: 0.75rem;
}

.login-tagline {
  font-size: 1.05rem;
  color: var(--fg-muted);
  margin-bottom: 2.5rem;
  line-height: 1.5;
}

/* Feature list */
.feature-list {
  text-align: left;
  max-width: 540px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.feature {
  display: flex;
  gap: 0.75rem;
  line-height: 1.5;
}

.dash {
  color: var(--accent);
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 0.05em;
}

.feature-title {
  font-weight: 600;
  color: var(--fg);
}

.feature-desc {
  color: var(--fg-muted);
}

/* Forms */
input, select {
  font-family: var(--font-body);
  font-size: 0.875rem;
  background: var(--bg-surface);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.6rem 1rem;
  width: 100%;
  transition: var(--transition);
}
input:focus, select:focus {
  outline: none;
  border-color: var(--accent);
  background: rgba(22, 22, 24, 0.95);
}

.form-group { margin-bottom: 1.25rem; }
.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-muted);
  margin-bottom: 0.5rem;
}
.form-row { display: flex; gap: 0.75rem; align-items: flex-start; }

/* Layout & Structure */
.container {
  max-width: 768px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  position: relative;
  z-index: 1;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0 2rem 0;
  margin-bottom: 2.5rem;
  border-bottom: 1px solid var(--border);
}
header h1 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 400;
  font-style: italic;
  letter-spacing: 0;
}
header h1 a { color: var(--accent); }
header h1 a:hover { color: var(--accent-hover); }
header .user-info { font-size: 0.875rem; color: var(--fg-muted); margin-right: 1rem; }

.global-footer {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 0.85rem;
  color: var(--fg-dim);
}
.global-footer a {
  color: var(--fg-muted);
  text-decoration: underline;
  text-decoration-color: var(--border);
  text-underline-offset: 4px;
}
.global-footer a:hover {
  color: var(--fg);
  text-decoration-color: var(--fg-muted);
}

/* Responsive Media Queries */
@media (max-width: 600px) {
  .login-title { font-size: 2.25rem; }
  .cta-group { flex-direction: column; align-items: center; }
  .btn-primary, .btn-ghost { width: 100%; justify-content: center; }
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
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  transition: var(--transition);
}
.card.clickable:hover {
  border-color: var(--border-hover);
}
.card h3 {
  margin-bottom: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--fg);
}
.card .meta { font-size: 0.875rem; color: var(--fg-muted); }

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
  color: var(--fg-muted);
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
.vault-date { flex-shrink: 0; font-size: 0.8rem; color: var(--fg-muted); }

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
  color: var(--fg-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: var(--transition);
  position: relative;
  bottom: -1px;
}
.tab:hover:not(.disabled) { color: var(--fg); }
.tab.active { color: var(--fg); border-bottom-color: var(--accent); }
.tab.disabled { color: var(--fg-dim); cursor: not-allowed; opacity: 0.5; }

/* Utilities */
.hidden { display: none !important; }
.empty { text-align: center; color: var(--fg-muted); padding: 3rem 1rem; }
.error { color: var(--danger); font-size: 0.875rem; padding: 0.75rem; background: rgba(212, 80, 76, 0.1); border-radius: var(--radius-sm); margin-top: 0.75rem; border: 1px solid rgba(212, 80, 76, 0.2); }
.success { color: var(--success); font-size: 0.875rem; padding: 0.75rem; background: rgba(74, 158, 107, 0.1); border-radius: var(--radius-sm); margin-top: 0.75rem; border: 1px solid rgba(74, 158, 107, 0.2); }
.loading { text-align: center; color: var(--fg-muted); padding: 3rem; font-weight: 500; }
.loading::after {
  content: "...";
  animation: dots 1.5s steps(5, end) infinite;
}
@keyframes dots {
  0%, 20% { color: transparent; text-shadow: .25em 0 0 transparent, .5em 0 0 transparent; }
  40% { color: var(--fg-muted); text-shadow: .25em 0 0 transparent, .5em 0 0 transparent; }
  60% { text-shadow: .25em 0 0 var(--fg-muted), .5em 0 0 transparent; }
  80%, 100% { text-shadow: .25em 0 0 var(--fg-muted), .5em 0 0 var(--fg-muted); }
}

.nav-back {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--fg-muted);
}
.nav-back:hover { color: var(--fg); }

.copyable {
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.85em;
  transition: var(--transition);
}
.copyable:hover { background: var(--bg-surface-hover); border-color: var(--border-hover); }
.copyable.copied { background: var(--success); border-color: var(--success); color: #fff; }

/* Code / Note Viewer */
.file-viewer {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
}
.file-viewer .md-h { color: var(--accent); font-weight: 700; margin-top: 1rem; display: inline-block; }
.file-viewer .md-bold { font-weight: 700; color: var(--fg); }
.file-viewer .md-italic { font-style: italic; color: var(--fg); }
.file-viewer .md-wikilink {
  color: var(--link);
  cursor: pointer;
  text-decoration: none;
  background: rgba(123, 158, 194, 0.1);
  padding: 0 0.2rem;
  border-radius: 4px;
}
.file-viewer .md-wikilink:hover { background: rgba(123, 158, 194, 0.2); }
.file-viewer .md-link { color: var(--link); text-decoration: underline; }
.file-viewer .md-hr { color: var(--border); border-top: 1px solid var(--border); display: block; margin: 1rem 0; width: 100%; height: 0; }
.file-viewer .md-list { color: var(--accent); font-weight: bold; }
.file-viewer .md-frontmatter { color: var(--fg-dim); }

.file-path {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--fg-muted);
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
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
}
.file-meta-key { color: var(--fg-muted); font-weight: 500; }
.file-meta-val { color: var(--fg); font-family: var(--font-mono); }
`;
