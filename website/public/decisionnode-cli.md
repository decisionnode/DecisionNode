# DecisionNode CLI Reference

> Quick reference for AI agents using the `decide` CLI directly (not via MCP).

---

## When to use the CLI vs MCP

Use the CLI when you need to run shell commands directly (e.g., via a `Bash` tool). Use MCP tools when they're available in your tool list. Both access the same data.

---

## Core Commands

```bash
# Setup
decide init                           # Initialize project store
decide setup                          # Configure Gemini API key

# Add decisions
decide add                            # Interactive add (prompts for scope, decision, rationale, constraints)
decide add -s Backend -d "Use PostgreSQL" -r "Team knows SQL" -c "No MongoDB"  # Inline add
decide add -s Security -d "Never store tokens in localStorage" --global        # Global (all projects)
decide add -s Backend -d "Use connection pooling" --force                      # Skip conflict check

# Search
decide search "how should we handle auth?"   # Semantic search (active only, includes global)

# View
decide list                           # List all decisions (includes global)
decide list --scope Backend           # Filter by scope
decide list --global                  # Only global decisions
decide get backend-001                # View full details
decide get global:security-001        # View global decision

# Edit
decide edit backend-001               # Interactive edit
decide edit global:security-001 -f    # Skip global confirmation

# Lifecycle
decide deprecate backend-001          # Hide from search, keep embedding (reversible)
decide activate backend-001           # Re-activate, immediately searchable again

# Delete
decide delete backend-001 -f          # Permanently delete, skip confirmation
decide delete-scope Backend -f        # Delete entire scope, skip confirmation

# Data & maintenance
decide export json                    # Export to terminal (formats: md, json, csv)
decide export --global                # Export global decisions
decide import decisions.json          # Import from JSON file
decide check                          # Show decisions missing embeddings
decide embed                          # Generate missing embeddings
decide clean                          # Remove orphaned vectors
decide history                        # View activity log
decide history --filter cli           # Filter by source (cli, mcp, cloud)
decide config                         # View/set configuration
decide projects                       # List all initialized projects

# Web UI (graph + vector space + list)
decide ui                             # Launch local UI in foreground (Ctrl+C to stop)
decide ui -d                          # Launch in background, return the terminal
decide ui --port 7788                 # Pick a specific port
decide ui --no-open                   # Don't auto-open the browser
decide ui status                      # Show whether the background server is running
decide ui stop                        # Stop the background server
```

---

## Decision Structure

```json
{
  "id": "backend-001",
  "scope": "Backend",
  "decision": "Use PostgreSQL for all persistent storage",
  "status": "active",
  "rationale": "Team expertise, ACID compliance, strong ecosystem",
  "constraints": ["No MongoDB", "No SQLite for production data"],
  "createdAt": "2024-11-14T09:22:00Z"
}
```

**Fields:** `id` (auto-generated), `scope` (required), `decision` (required), `status` (active/deprecated), `rationale` (optional), `constraints` (optional), `createdAt` (auto).

---

## Flags Summary

| Flag | Commands | Effect |
|------|----------|--------|
| `-f` / `--force` | `delete`, `delete-scope`, `edit` | Skip confirmation prompts |
| `--force` | `add` (inline) | Skip conflict check |
| `--global` | `add`, `list`, `export`, `import` | Use global store (all projects) |
| `--scope <scope>` | `list` | Filter by scope |
| `--overwrite` | `import` | Overwrite existing decisions |
| `--filter <source>` | `history` | Filter by source (`cli`, `mcp`, `cloud`) |

---

## Tips for AI agents

- Always run `decide search` before adding a decision to avoid duplicates.
- Use `--force` on `add` to skip the conflict check when you're sure it's not a duplicate.
- Use `-f` on `delete` and `delete-scope` to avoid interactive prompts that will hang.
- Global decisions (prefixed `global:`) apply to all projects. Use them for cross-cutting concerns like security or coding standards.
- The CLI logs the source as `cli`. MCP logs the client name (e.g. `claude-code`, `cursor`).
