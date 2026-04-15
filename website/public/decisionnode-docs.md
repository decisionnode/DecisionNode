# DecisionNode

> Record a decision, embed it as a vector, search it later. Works from the CLI or through your AI via MCP.

---

## Overview

DecisionNode stores development decisions as structured JSON objects, embeds them as vectors using Gemini, and retrieves them via cosine similarity search. The AI calls `search_decisions` through MCP when it needs context — decisions are not injected into a system prompt.

The same decision store is accessible from any MCP-compatible tool (Claude Code, Cursor, Windsurf, Antigravity, etc.).

### Two Interfaces

| Interface | For | How |
|-----------|-----|-----|
| **CLI** (`decide` / `decisionnode`) | You and your AI | Terminal commands, interactive prompts or inline flags |
| **MCP Server** (`decide-mcp`) | Your AI and you | Structured JSON over MCP, launched automatically by AI clients |

Both read and write to the same local store at `~/.decisionnode/`.

---

## Installation

```bash
npm install -g decisionnode
```

This installs three executables:

| Command | Purpose |
|---------|---------|
| `decide` | CLI (short alias) |
| `decisionnode` | CLI (full name, same thing) |
| `decide-mcp` | MCP server (launched by AI clients, not run directly) |

---

## Quickstart

### Step 1: Initialize

```bash
cd your-project
decide init
```

Creates `~/.decisionnode/.decisions/<ProjectName>/`.

### Step 2: Set up API key

```bash
decide setup
```

Get a free key from [Google AI Studio](https://aistudio.google.com/) and paste it when prompted. Saved to `~/.decisionnode/.env`.

### Step 3: Connect your AI

**Claude Code** (run once, works in every project):

```bash
claude mcp add decisionnode -s user decide-mcp
```

**Cursor** — edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "decisionnode": { "command": "decide-mcp", "args": [] }
  }
}
```

**Windsurf** — edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "decisionnode": { "command": "decide-mcp", "args": [] }
  }
}
```

**Antigravity** — edit `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "decisionnode": { "command": "decide-mcp", "args": [] }
  }
}
```

**Claude Desktop** — edit config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "decisionnode": { "command": "decide-mcp", "args": [] }
  }
}
```

**Other clients** — use `decide-mcp` with no arguments via stdio transport. Fallback: `npx -y decisionnode start-server`.

### Step 4: Add a decision

```bash
decide add
```

Prompts for:

| Field | Required | Description |
|-------|----------|-------------|
| **Scope** | Yes | Architectural domain (e.g. UI, Backend, API, Security) |
| **Decision** | Yes | Clear statement of what was decided |
| **Rationale** | No | The reasoning behind the choice |
| **Constraints** | No | Specific rules to follow, comma-separated |

One-command alternative:

```bash
decide add -s UI -d "Use Tailwind for all styling" -r "Consistent tokens" -c "No arbitrary values"
```

### Step 5: Search

```bash
decide search "how should we style components?"
```

---

## Decision Structure

A decision is a scoped JSON object:

```json
{
  "id": "ui-001",
  "scope": "UI",
  "decision": "Use Tailwind CSS for all styling",
  "status": "active",
  "rationale": "Consistent design tokens, easy for AI to generate correct classes.",
  "constraints": [
    "No arbitrary values (e.g. w-[37px]) unless absolutely necessary",
    "Use @apply only for reusable base components"
  ],
  "createdAt": "2024-03-20T10:00:00Z"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated: scope prefix + 3-digit number (e.g. `ui-001`, `backend-003`). Global decisions use `global:` prefix. |
| `scope` | string | Architectural domain, normalized to title case. Each scope = one JSON file. |
| `decision` | string | Clear, actionable statement. One sentence. |
| `status` | `"active"` \| `"deprecated"` | Active = appears in search. Deprecated = hidden from search, embedding preserved. |
| `rationale` | string? | The "why". Helps the AI understand intent behind the decision. |
| `constraints` | string[]? | Hard requirements the AI should follow. |
| `createdAt` | ISO 8601 | When the decision was created. |

### Lifecycle

| Status | Searchable | Embedding | How to change |
|--------|-----------|-----------|---------------|
| `active` | Yes | Preserved | Default state |
| `deprecated` | No | Preserved | `decide deprecate <id>` or `update_decision(status="deprecated")` |
| (deleted) | N/A | Removed | `decide delete <id> [-f]` or `delete_decision(id)` |

Re-activate a deprecated decision: `decide activate <id>` — immediately searchable again.

---

## Context Engine

### How Embedding Works

1. **Text generation** — the embedded text is: `{scope}: {decision}. {rationale} {constraints}`
2. **Embedding model** — Gemini `gemini-embedding-001` (768 dimensions)
3. **Storage** — vectors cached in `vectors.json` per project:
   ```json
   { "ui-001": { "vector": [0.12, -0.45, ...], "embeddedAt": "2024-..." } }
   ```
4. **Global vectors** — stored separately in `~/.decisionnode/.decisions/_global/vectors.json`

### How Search Works

1. Query text is embedded using the same model
2. Cosine similarity is computed against every stored vector
3. Results below the **search threshold** (default `0.3`) are filtered out
4. Remaining results are sorted by score (highest first) and returned up to the limit

Only `active` decisions are searched. Deprecated decisions are skipped. Global decisions are always included alongside project decisions.

### Conflict Detection

When adding a decision (CLI or MCP), existing decisions are checked at **75% similarity**:

- **CLI** — shows similar decisions, asks "Continue anyway?"
- **MCP** — returns the similar decisions without adding. The AI can update the existing one, deprecate it, or re-call `add_decision(force=true)`.

If the API key is missing, conflict detection is silently skipped.

---

## Configuration

### Storage Layout

```
~/.decisionnode/
  .env                          # Gemini API key
  config.json                   # Settings (agent behavior, threshold)
  .decisions/
    _global/                    # Global decisions (all projects)
      ui.json
      vectors.json
    MyProject/
      ui.json                   # Scope: "UI"
      backend.json              # Scope: "Backend"
      vectors.json              # Embedding cache
      history/
        activity.json           # Audit log
```

### Config Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `agentBehavior` | `"strict"` \| `"relaxed"` | `"strict"` | Changes the `search_decisions` tool description. Strict makes searching mandatory, relaxed leaves it to the AI's judgment. Requires MCP restart. |
| `searchThreshold` | `0.0–1.0` | `0.3` | Minimum similarity score for search results. Applies immediately. |

```bash
decide config                              # View all settings
decide config agent-behavior strict        # AI must search before any code change
decide config agent-behavior relaxed      # AI searches when it thinks it's relevant
decide config search-threshold 0.5         # Only 50%+ similarity results
decide config search-threshold 0.2         # More permissive results
```

### Global Decisions

Decisions that apply across all projects:

```bash
decide add --global -s Security -d "Never commit .env files"
```

Stored in `~/.decisionnode/.decisions/_global/`. Included in every project's search results. IDs use `global:` prefix (e.g. `global:security-001`).

### Multiple Projects

Each project is identified by its directory name. The MCP server resolves the project automatically from the AI client's working directory.

```bash
decide projects    # List all projects
```

---

## CLI Reference

All commands work with both `decide` and `decisionnode`.

### Core Commands

| Command | Description |
|---------|-------------|
| `decide init` | Initialize project store |
| `decide setup` | Configure Gemini API key |
| `decide add` | Add a decision (interactive) |
| `decide add -s <scope> -d <text> [-r <rationale>] [-c <constraints>]` | Add a decision (one command) |
| `decide add --global` | Add a global decision |
| `decide list [--scope <scope>]` | List all decisions (includes global) |
| `decide list --global` | List only global decisions |
| `decide get <id>` | View full details (supports `global:` prefix) |
| `decide search "<query>"` | Semantic search (active only, includes global) |
| `decide edit <id> [-f]` | Edit decision fields (supports `global:` prefix, use `-f` to skip global confirmation) |
| `decide deprecate <id>` | Hide from search, keep embedding |
| `decide activate <id>` | Re-activate, immediately searchable |
| `decide delete <id> [-f]` | Permanently delete decision + embedding (use `-f` to skip confirmation) |
| `decide delete-scope <scope> [-f]` | Delete entire scope (use `-f` to skip confirmation) |

### Data & Maintenance

| Command | Description |
|---------|-------------|
| `decide export [format]` | Export to terminal. Formats: `md` (default), `json`, `csv` |
| `decide export --global` | Export global decisions |
| `decide import <file> [--overwrite]` | Import from JSON file |
| `decide import <file> --global` | Import into global store |
| `decide check` | Show decisions missing embeddings |
| `decide embed` | Generate embeddings for unembedded decisions |
| `decide clean` | Remove orphaned vectors |
| `decide history [--filter <source>]` | View activity log. Shows which tool made each change (e.g. `cli`, `claude-code`, `cursor`). Filter: `cli`, `mcp`, `cloud` |
| `decide projects` | List all projects |
| `decide config` | View/set configuration |

### Web UI

A local web UI for visualizing and browsing decisions. Three views (graph, vector space, list) backed by the same store, with a live MCP pulse that animates AI activity in real time. Read-only — the CLI and MCP remain the write paths.

| Command | Description |
|---------|-------------|
| `decide ui [--port N] [--no-open]` | Launch local web UI in foreground (Ctrl+C to stop). Defaults to `http://localhost:7788`. |
| `decide ui -d` / `decide ui --detach` | Run the UI in the background and return your terminal immediately. |
| `decide ui status` | Show whether the background UI server is running (URL, PID, uptime). |
| `decide ui stop` | Stop the background UI server. |

The three views:
- **Graph** — force-directed network where nodes are decisions and edges connect decisions whose embeddings are semantically similar. Adjustable similarity threshold via slider.
- **Vector Space** — UMAP projection of the 3072-dim Gemini embeddings into 2D, drawn as actual vectors radiating from origin. Watch semantic clusters form.
- **List** — searchable, filterable cards grouped by scope.

When an MCP client (Claude Code, Cursor, Windsurf, Antigravity, Cline, etc.) calls `search_decisions`, matched nodes pulse in the UI in real time with that client's attribution color. CLI mutations (add/edit/delete) also animate live via file watching.

---

## MCP Tools (9)

These tools are available to any connected AI agent.

### search_decisions

```
search_decisions(query: string, limit?: number, project?: string)
```

Semantic search across active decisions. Includes global decisions. Returns matches with similarity scores. Results below the configured threshold are filtered out.

### list_decisions

```
list_decisions(scope?: string, project?: string)
```

List all decisions for a project, including global. Optionally filter by scope.

### get_decision

```
get_decision(id: string, project?: string)
```

Get full details by ID. Supports `global:` prefix (e.g. `global:ui-001`).

### add_decision

```
add_decision(scope: string, decision: string, rationale?: string, constraints?: string[], global?: boolean, force?: boolean, project?: string)
```

Record a new decision. If similar decisions exist (75% similarity), returns them instead of adding. Re-call with `force=true` to override. Set `global=true` for cross-project decisions.

### update_decision

```
update_decision(id: string, decision?: string, rationale?: string, status?: string, constraints?: string[], project?: string)
```

Update an existing decision. Supports `global:` prefix. Set `status` to `"deprecated"` or `"active"`.

### delete_decision

```
delete_decision(id: string, project?: string)
```

Permanently delete a decision and its embedding. Supports `global:` prefix.

### get_history

```
get_history(limit?: number, project?: string)
```

Activity log of recent changes (adds, edits, deletes). Each entry shows the source — `cli` for terminal commands, or the MCP client name (e.g. `claude-code`, `cursor`, `windsurf`) for AI-initiated changes.

### get_status

```
get_status(project?: string)
```

Project overview: total decisions, active count, last activity.

### list_projects

```
list_projects(verbose?: boolean)
```

All projects with decision counts, plus global count.

---

## Links

- **GitHub**: https://github.com/decisionnode/decisionnode
- **Website**: https://decisionnode.dev
- **License**: MIT
- **MCP Protocol**: https://modelcontextprotocol.io
