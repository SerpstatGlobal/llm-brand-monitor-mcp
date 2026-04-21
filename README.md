# LLM Brand Monitor MCP Server

[MCP](https://modelcontextprotocol.io/) server for [LLM Brand Monitor](https://llmbrandmonitor.com) — a platform that tracks how AI models mention your brand.

Connect Claude, Cursor, Windsurf, or any MCP-compatible client to manage brand monitoring projects, run scans across 350+ LLMs, and analyze results — all through natural language.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lbm": {
      "command": "npx",
      "args": ["-y", "llm-brand-monitor-mcp"],
      "env": {
        "LBM_API_KEY": "lbm_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add lbm-mcp -e LBM_API_KEY=lbm_your_key_here -- npx -y llm-brand-monitor-mcp
```

### From Source

```bash
git clone https://github.com/SerpstatGlobal/llm-brand-monitor-mcp.git
cd llm-brand-monitor-mcp
npm install && npm run build
```

Then add to your MCP client config:

```json
{
  "mcpServers": {
    "lbm": {
      "command": "node",
      "args": ["/path/to/llm-brand-monitor-mcp/dist/index.js"],
      "env": {
        "LBM_API_KEY": "lbm_your_key_here"
      }
    }
  }
}
```

### MCP Inspector

```bash
LBM_API_KEY=lbm_your_key_here npx @modelcontextprotocol/inspector node dist/index.js
```

## Getting an API Key

1. Sign up at [llmbrandmonitor.com](https://llmbrandmonitor.com)
2. Go to **Settings** > **API Keys**
3. Create a new key (starts with `lbm_`)

## Tools

17 tools across 4 categories:

### Projects (7 tools)

| Tool | What it does |
|---|---|
| `lbm_list_projects` | List all brand monitoring projects |
| `lbm_get_project` | Get project details with prompts and models |
| `lbm_create_project` | Create a new project |
| `lbm_update_project` | Update project name, models, or monitoring settings |
| `lbm_archive_project` | Archive a project |
| `lbm_add_prompts` | Add monitoring prompts to a project |
| `lbm_delete_prompt` | Remove a prompt from a project |

### Scans (3 tools)

| Tool | What it does |
|---|---|
| `lbm_run_scan` | Start a scan — sends prompts to LLMs and collects responses |
| `lbm_get_scan_status` | Check scan progress |
| `lbm_list_scans` | View scan history |

### Results (5 tools)

| Tool | What it does |
|---|---|
| `lbm_list_results` | Browse monitoring results (brand mentions, status) |
| `lbm_get_transcript` | Read the full LLM response for a specific result |
| `lbm_list_competitors` | See which competitor brands LLMs mention |
| `lbm_list_links` | See which URLs and domains LLMs cite |
| `lbm_get_history` | Competitor mention trends over time |

### Models & Usage (2 tools)

| Tool | What it does |
|---|---|
| `lbm_list_models` | List 350+ available LLM models |
| `lbm_get_usage` | Check credit balance and usage stats |

## Typical Workflow

```
You: "What brand monitoring projects do I have?"
Claude: → lbm_list_projects

You: "Run a scan on the Serpstat project"
Claude: → lbm_run_scan (asks you to confirm — scans spend credits)
       → lbm_get_scan_status (polls until complete)

You: "Show me the results — which models mentioned my brand?"
Claude: → lbm_list_results

You: "What did GPT-5 say exactly?"
Claude: → lbm_get_transcript

You: "Who are my competitors according to AI models?"
Claude: → lbm_list_competitors
```

## Token-Efficient Responses

All list tools return **compact CSV by default** instead of verbose JSON. This reduces token usage by 80–96%, keeping responses within context limits.

```
# Default (CSV) — 3-6 key columns
competitor,mentions,visibility_pct
Competitor A,178,72.4
Competitor B,105,42.7

# Full JSON — pass include_all_fields: true
{"data": [{"competitor_id": "...", "competitor_name": "Competitor A", ...}]}
```

All list tools support `offset` and `limit` for pagination.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `LBM_API_KEY` | Yes | — | API key from llmbrandmonitor.com |
| `LBM_API_BASE_URL` | No | `https://llmbrandmonitor.com/api/v1` | API base URL |
| `LOG_LEVEL` | No | `info` | `error`, `warn`, `info`, `debug` |

## Error Handling

Errors include actionable hints for the LLM:

| Error | Hint |
|---|---|
| `INSUFFICIENT_CREDITS` | Check balance with `lbm_get_usage`. Top up at llmbrandmonitor.com/pricing |
| `RATE_LIMITED` | Wait a few seconds and retry |
| `NOT_FOUND` | Call `lbm_list_projects` to verify the ID exists |
| `UNAUTHORIZED` | API key is invalid — check `LBM_API_KEY` |

## Development

```bash
npm install
npm run build    # TypeScript → dist/
npm test         # 126 tests
```

## API Documentation

Full REST API docs: [llmbrandmonitor.com/api-docs](https://llmbrandmonitor.com/api-docs)

## License

MIT
