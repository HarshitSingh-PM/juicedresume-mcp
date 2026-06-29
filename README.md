# @juicedresume/mcp

Stdio [Model Context Protocol](https://modelcontextprotocol.io) server for [JuicedResume](https://juicedresume.com) — score, tailor, and edit your resume from any MCP client (Claude Code, Claude Desktop, Cursor, Zed).

## Install

```bash
npm install -g @juicedresume/mcp
```

Or use `npx` directly in your MCP config — no install needed.

## Use in Claude Code

```bash
claude mcp add --transport stdio juicedresume -- npx -y @juicedresume/mcp
```

Then `/mcp` inside Claude Code → enable `juicedresume`.

## Use in Claude Desktop / other clients

Add to your MCP server config:

```json
{
  "mcpServers": {
    "juicedresume": {
      "command": "npx",
      "args": ["-y", "@juicedresume/mcp"]
    }
  }
}
```

## Authentication

Grab your MCP token from **Settings → AI** at [juicedresume.com](https://juicedresume.com) and add it to the server's environment. MCP access is included on the Basic, Pro, and Lifetime plans.

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

The MCP server reads and writes to the same store as the JuicedResume web app at <https://juicedresume.com>. Changes made via MCP appear in the web editor immediately, and vice-versa.

## Source & build

This repository is the public home and source of the MCP server. The package is built and published to npm from the JuicedResume monorepo, where the scoring engine and resume schema live as shared workspace packages — so to run it, install the published package (`npx -y @juicedresume/mcp`) rather than building from this repo directly.

## License

MIT — © Harshit Singh
