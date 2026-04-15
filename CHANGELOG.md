# Changelog

All notable changes to DecisionNode are documented here.

## [0.6.0] - 2026-04-16

### Added
- **`decide ui`** — local web UI for visualizing decisions. Three views, all backed by the same store and filter state:
    - **Graph view** — force-directed (Cytoscape.js + fcose), nodes are decisions, edges are cosine similarity. 3D-orb node styling with bloom glow, Obsidian-style hover-fade. Adjustable similarity threshold via slider.
    - **Vector Space view** — UMAP projection of the 3072-dim Gemini embeddings into 2D, drawn as actual vectors radiating from origin with axes and 3D-orb tips. Pan, zoom, and click to select.
    - **List view** — searchable, filterable, sortable cards grouped by scope. The boring-but-essential view for actually reading decisions.
- **Live MCP pulse** — when an AI client (Claude Code, Cursor, Windsurf, Antigravity, Cline, etc.) calls `search_decisions`, the matched nodes pulse in real time with that client's attribution color via SSE. New lightweight append-only `pulses.jsonl` log avoids polluting `activity.json` with read-only events.
- **Live CLI updates** — adding/editing/deleting decisions in another terminal animates into the UI immediately (file watching via `fs.watch`).
- **Project switcher modal** — searchable, sortable, paginated picker. Replaces the old dropdown.
- **Shared filter bar** — text + status filters apply to all three views simultaneously. Switch views, the filter follows.
- **Side panel** with full per-decision activity timeline, color-coded by source (cli / mcp:claude-code / mcp:cursor / etc.).
- **PNG export** — download or copy current view to clipboard at 3× DPI for sharing.
- **First-run tour** — 5-step modal explains the views, filter bar, click-to-select, live MCP pulse, and keyboard shortcuts.
- **Background mode** — `decide ui -d` (or `--detach`) spawns the UI as a detached process and returns the terminal. `decide ui status` and `decide ui stop` for daemon management.
- New module `src/pulse.ts` for lightweight read-only event logging from the MCP server.

### Changed
- README, CLI reference docs, and decisionnode-cli.md updated with all the new `ui` subcommands.
- Default node colors now drawn from the brand palette (shades of primary cyan + accent yellow) instead of a generic rainbow.

### Tech notes
- New devDependencies: `esbuild`, `preact`, `cytoscape`, `cytoscape-fcose`, `umap-js`, `tailwindcss`, `@tailwindcss/cli`. All bundled at build time — zero new runtime dependencies.
- New build step: `scripts/build-ui.mjs` (esbuild + tailwindcss + html copy).
- Bundled UI ships in `dist/ui/` inside the npm tarball.
- HTTP server uses Node's built-in `http` module — no Express, no extra runtime deps.

## [0.5.3] - 2026-04-11

### Added
- `.github/FUNDING.yml` for GitHub Sponsors
- npm and license badge links in README (now clickable)
- "View on npm" link in website footer

### Fixed
- `repository.url` in package.json now uses correct `git+https://...git` format — fixes Snyk/npm not linking to the GitHub repo (was causing "Last Commit: Unknown" and missing stats)

## [0.5.2] - 2026-04-11

### Added
- `-f` / `--force` flag on `decide delete`, `decide delete-scope`, and `decide edit` to skip confirmation prompts — useful for scripts and AI agents
- Standalone CLI reference markdown (`decisionnode-cli.md`) published at decisionnode.dev/decisionnode-cli.md for LLM consumption
- CLI reference link added to docs sidebar and footer

### Changed
- Removed "Results for:" line from search output for cleaner display
- Updated "Two interfaces" messaging: CLI is for you and your AI, MCP server is for your AI and you

## [0.5.1] - 2026-04-08

### Added
- `glama.json` for Glama MCP registry listing

### Changed
- Updated README subtitle with cross-tool compatibility messaging

## [0.5.0] - 2026-04-06

### Added
- Configurable search threshold (`decide config search-threshold`, default 0.3)
- Search results below threshold are now filtered out (CLI + MCP)
- MCP client name tracking in history — shows `claude-code`, `cursor`, etc. instead of generic "MCP"
- Conflict detection now works in inline mode (`decide add -s ... -d ...`), not just interactive
- Agent behavior setting (`decide config agent-behavior strict|relaxed`) — renamed from search-sensitivity
- Feature recordings (VHS) for history, conflict, deprecate, global, threshold, embed, behavior
- Colorized history output — action words, decision IDs, and MCP client names in color
- "Copy page for AI" button outputs proper markdown instead of raw text
- ROADMAP.md with tiered priorities
- Accurate MCP setup instructions for Cursor, Windsurf, Antigravity, Claude Desktop
- Homepage feature grid with embedded terminal recordings

### Changed
- Repositioned messaging: "Record a decision, embed it as a vector, search it later"
- Renamed search-sensitivity to agent-behavior (strict/relaxed instead of high/medium)
- Updated all docs, README, LLM docs, homepage for consistency
- History log shows Deprecated/Activated instead of generic "Updated"
- MCP updates and deletes now log with correct source

## [0.4.0] - 2026-04-06

### Added
- Polished CLI with colored output, box-drawing, and branded banner
- Hidden API key input in `decide setup` (password-style)
- Test suite: 32 tests (unit, integration, smoke) with Vitest
- CHANGELOG.md
- GitHub issue templates, PR template, and CI workflow (Node 20/22)

### Changed
- Removed `.mcp.json` from repo (users connect via `claude mcp add`)
- Requires Node >= 20

## [0.3.0] - 2026-04-05

### Added
- MCP setup instructions for Claude Code, Cursor, Windsurf, Antigravity, Claude Desktop
- Open Graph preview image for link sharing
- JSON-LD structured data for Google rich results
- Sitemap, robots.txt, SEO meta tags
- Mobile responsive docs layout
- GitHub stars badge on landing page and docs sidebar
- Anchor links on all docs sections

### Changed
- MCP setup now uses `claude mcp add decisionnode -s user decide-mcp` instead of `.mcp.json`
- `decide init` no longer creates `.mcp.json`
- Removed references to VS Code extension, marketplace, and cloud sync from website

### Fixed
- MCP server connection issues on Windows

## [0.2.0] - 2026-04-05

### Fixed
- npm version conflict (v0.1.0 was permanently locked after unpublish)

## [0.1.0] - 2026-04-05

### Added
- CLI with commands: init, setup, add, list, get, search, edit, delete, deprecate, activate, check, embed, export, import, history, projects, config
- Inline add with `-s`, `-d`, `-r`, `-c` flags
- MCP server with 9 tools for AI agent integration
- Semantic search via Gemini `gemini-embedding-001` embeddings
- Cosine similarity scoring with ranked results
- Global decisions (`--global` flag, `global:` prefix, shared across projects)
- Conflict detection at 75% similarity threshold
- Decision lifecycle: active and deprecated statuses
- Activity history with audit log
- Export to JSON, Markdown, CSV
- Import from JSON with optional overwrite
- Agent behavior configuration (strict/relaxed)
- Per-project storage in `~/.decisionnode/.decisions/`
