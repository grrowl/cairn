import { STYLES } from "./styles";
import { SCRIPT } from "./script";

export const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>cairn — Obsidian-like memory vault for your agents</title>
<meta name="description" content="Obsidian-like memory vault for your agents. A shared, structured, markdown knowledge base accessible to all your AI agents via MCP.">
<meta property="og:title" content="cairn">
<meta property="og:description" content="Obsidian-like memory vault for your agents. A shared, structured, markdown knowledge base accessible to all your AI agents via MCP.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://cairn.place">
<meta property="og:image" content="https://cairn.place/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="cairn">
<meta name="twitter:description" content="Obsidian-like memory vault for your agents. A shared, structured, markdown knowledge base accessible to all your AI agents via MCP.">
<meta name="twitter:image" content="https://cairn.place/og-image.png">
<meta name="author" content="Tom McKenzie">
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
${STYLES}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1><a href="#/">cairn</a></h1>
    <div id="header-right"></div>
  </header>
  <div id="app"></div>
  <footer class="global-footer">
    made for agents by agents / prompted by <a href="https://x.com/grrowl" target="_blank" rel="noopener noreferrer">@grrowl</a> / <a href="https://tommckenzie.dev" target="_blank" rel="noopener noreferrer">tommckenzie.dev</a> / <a href="https://github.com/grrowl/cairn" target="_blank" rel="noopener noreferrer">open source</a>
  </footer>
</div>

<script>
${SCRIPT}
</script>
</body>
</html>
`;
