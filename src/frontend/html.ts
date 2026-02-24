import { STYLES } from "./styles";
import { SCRIPT } from "./script";

export const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>cairn — Obsidian-like memory vault for your AI assistants</title>
<meta name="description" content="Obsidian-like memory vault for your AI assistants. Shared, structured, back-linked markdown notes accessible to all your AI agents via MCP.">
<meta property="og:title" content="cairn">
<meta property="og:description" content="Obsidian-like memory vault for your AI assistants. Shareable MCP knowledge vault.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://cairn.place">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="cairn">
<meta name="twitter:description" content="Obsidian-like memory vault for your AI assistants. Shareable MCP knowledge vault.">
<meta name="author" content="Tom McKenzie">
<link rel="icon" href="/favicon.ico">
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
</div>

<script>
${SCRIPT}
</script>
</body>
</html>
`;
