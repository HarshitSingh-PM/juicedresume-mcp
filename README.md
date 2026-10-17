# JuicedResume MCP Server

[![npm](https://img.shields.io/npm/v/@juicedresume/mcp)](https://www.npmjs.com/package/@juicedresume/mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-com.juicedresume%2Fmcp-blue)](https://registry.modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

> **The only resume builder with a first-party [Model Context Protocol](https://modelcontextprotocol.io) server.**
> Connect **Claude Code**, **Claude Desktop**, **Cursor**, or **Zed** to [JuicedResume](https://juicedresume.com) and **build, score, tailor, and export ATS-optimized resumes** — in natural language, against your real cloud resumes.

Looking for a **resume builder with an MCP server for Claude**? This is it. Instead of copy-pasting your resume into a chat, point your MCP client at your JuicedResume account and ask Claude to *score it against 60+ ATS checks*, *tailor it to a job description*, or *rewrite a weak bullet* — the changes save straight to your resume and show up in the web editor instantly.

## Why use the MCP server

- **Score your resume from your editor** — run the same 60+ check, 7-dimension ATS rubric JuicedResume uses on the web, without leaving Claude.
- **Tailor to a job description** — get the matched and missing keywords for a specific JD and apply the changes in place.
- **Edit structurally** — add/remove/reorder sections and entries, set the template and styling, all as tool calls.
- **Export** — produce an ATS-perfect PDF or LaTeX.
- **Round-trips with the web app** — anything you change over MCP appears in the JuicedResume web editor immediately, and vice-versa.

## Install

```bash
npm install -g @juicedresume/mcp
```

Or use `npx` directly in your MCP config — no install needed.

### Claude Code

```bash
claude mcp add --transport stdio juicedresume -- npx -y @juicedresume/mcp
```

Then `/mcp` inside Claude Code → enable `juicedresume`.

### Claude Desktop / Cursor / Zed / any MCP client

```json
{
  "mcpServers": {
    "juicedresume": {
      "command": "npx",
      "args": ["-y", "@juicedresume/mcp"],
      "env": { "JUICEDRESUME_TOKEN": "your-token-here" }
    }
  }
}
```

## Authentication

Grab your MCP token from **Settings → AI** at [juicedresume.com](https://juicedresume.com) and pass it as `JUICEDRESUME_TOKEN`. MCP access is **free for every signed-in user** (Free plan included — 10 calls / 30 days); Basic, Pro, and Lifetime plans get unlimited MCP calls. AI actions (score, tailor) use monthly AI credits.

## Tools

| Category | Tools |
|---|---|
| Resumes | `list_resumes`, `get_resume`, `create_resume`, `delete_resume`, `duplicate_resume` |
| Identity | `set_personal_info`, `set_summary` |
| Sections | `add_section`, `remove_section`, `reorder_sections`, `rename_section`, `toggle_section_visibility` |
| Entries | `add_entry`, `update_entry`, `remove_entry` |
| Style | `set_template`, `set_styling`, `set_locale` |
| Intelligence | `score_resume`, `tailor_to_jd` |
| Lookups | `verb_lookup`, `skill_search`, `title_search`, `company_search` |
| Templates | `templates_list` |

## How it works

The MCP server reads and writes to the same store as the JuicedResume web app at <https://juicedresume.com>. Changes made via MCP appear in the web editor immediately, and vice-versa. Transport is **stdio**; the package exposes the `juicedresume-mcp` (and `juiced-mcp`) binaries.

## Links

- **Docs:** <https://juicedresume.com/mcp>
- **npm:** <https://www.npmjs.com/package/@juicedresume/mcp>
- **MCP Registry:** `com.juicedresume/mcp`
- **Web app:** <https://juicedresume.com>

## Source & build

This repository is the public home and source of the MCP server. The package is built and published to npm from the JuicedResume monorepo, where the scoring engine and resume schema live as shared workspace packages — so to run it, install the published package (`npx -y @juicedresume/mcp`) rather than building from this repo directly.

## License

MIT — © Harshit Singh
