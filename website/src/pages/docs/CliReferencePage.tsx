import { Section, CodeBlock } from '../../components/docs/DocsComponents';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function CliReferencePage() {
    const coreCommands = [
        {
            cmd: "decide init",
            desc: "Initialize DecisionNode for the current project. Creates the project store in ~/.decisionnode/.decisions/<ProjectName>/."
        },
        {
            cmd: "decide setup",
            desc: "Configure your Gemini API key interactively. Prompts you to paste your key and saves it to ~/.decisionnode/.env."
        },
        {
            cmd: "decide add",
            desc: "Interactively create a new decision. Prompts for scope, decision text, rationale (optional), and constraints (optional). Auto-embeds for search."
        },
        {
            cmd: "decide add -s <scope> -d <decision> [-r <rationale>] [-c <constraints>]",
            desc: "Add a decision in one command, no prompts. Also accepts --scope, --decision, --rationale, --constraints as long flags. Combine with --global for global decisions."
        },
        {
            cmd: "decide add --global",
            desc: "Add a global decision that applies to all projects. Works with both interactive and inline modes."
        },
        {
            cmd: "decide list [--scope <scope>]",
            desc: "List all decisions grouped by scope, including global decisions. Use --scope to filter to a specific scope."
        },
        {
            cmd: "decide list --global",
            desc: "List only global decisions."
        },
        {
            cmd: "decide get <id>",
            desc: "View the full details of a decision by ID. Use global: prefix for global decisions (e.g. global:ui-001)."
        },
        {
            cmd: "decide search \"<query>\"",
            desc: "Semantically search decisions using vector embeddings. Only returns active decisions — deprecated decisions are excluded. Automatically includes global decisions. Requires a Gemini API key."
        },
        {
            cmd: "decide edit <id> [-f]",
            desc: "Interactively edit a decision's text, rationale, and constraints. Supports global: prefix. Use -f or --force to skip global decision confirmation."
        },
        {
            cmd: "decide deprecate <id>",
            desc: "Deprecate a decision — hides it from search but keeps the decision and its embedding. Supports global: prefix."
        },
        {
            cmd: "decide activate <id>",
            desc: "Re-activate a deprecated decision. Immediately searchable again since the embedding is preserved. Supports global: prefix."
        },
        {
            cmd: "decide delete <id> [-f]",
            desc: "Permanently delete a decision and its embedding. Supports global: prefix. Use -f or --force to skip confirmation. Consider deprecating instead if you might want it back."
        },
        {
            cmd: "decide delete-scope <scope> [-f]",
            desc: "Delete an entire scope and all decisions within it. Use -f or --force to skip confirmation."
        },
    ];

    const dataCommands = [
        {
            cmd: "decide export [format]",
            desc: "Prints decisions to the terminal. Use > to save to a file: decide export json > ~/decisions.json — the file is created wherever you point it. Supported formats: md (default), json, csv."
        },
        {
            cmd: "decide export --global",
            desc: "Same as export but for global decisions only."
        },
        {
            cmd: "decide import <file.json> [--overwrite]",
            desc: "Import decisions from a JSON file into the current project. Pass the path to the file you exported: decide import ~/decisions.json. Use --overwrite to replace existing decisions with the same IDs."
        },
        {
            cmd: "decide import <file.json> --global",
            desc: "Import decisions into the global store instead of the current project."
        },
        {
            cmd: "decide check",
            desc: "Show which decisions are missing vector embeddings and aren't searchable. Covers both project and global decisions."
        },
        {
            cmd: "decide embed",
            desc: "Generate vector embeddings for any unembedded decisions. Run this after importing, or if embedding failed due to a missing API key."
        },
        {
            cmd: "decide clean",
            desc: "Remove orphaned vectors and review metadata that no longer correspond to existing decisions."
        },
        {
            cmd: "decide history [--filter <source>]",
            desc: "View the activity log showing recent adds, edits, deletes, and syncs. Filter by source: cli, mcp, cloud, or marketplace."
        },
        {
            cmd: "decide projects",
            desc: "List all projects with decisions. Shows global decisions separately at the top."
        },
        {
            cmd: "decide config",
            desc: "View current configuration. Subcommands: 'decide config agent-behavior strict|relaxed' to control how the AI uses DecisionNode, 'decide config search-threshold 0.0-1.0' to set minimum similarity score for results."
        },
    ];

    const uiCommands = [
        {
            cmd: "decide ui [--port N] [--no-open]",
            desc: "Launch the local web UI in the foreground. Three views: graph (force-directed similarity), vector space (UMAP projection of embeddings), and list. Live MCP pulse animates AI activity in real time. Defaults to port 7788, falls back to a random port if taken. Press Ctrl+C to stop."
        },
        {
            cmd: "decide ui -d  /  decide ui --detach",
            desc: "Run the UI server in the background and return your terminal immediately. Tracked via ~/.decisionnode/.ui-daemon.json. Combine with --port and --no-open."
        },
        {
            cmd: "decide ui status",
            desc: "Show whether the background UI server is running. Reports the URL, PID, and uptime."
        },
        {
            cmd: "decide ui stop",
            desc: "Stop a running background UI server. Cleans up the daemon state file."
        },
    ];

    return (
        <>
        <Helmet>
            <title>CLI Reference — DecisionNode Docs</title>
            <meta name="description" content="DecisionNode CLI command reference — all available commands, flags, and usage examples." />
            <link rel="canonical" href="https://decisionnode.dev/docs/cli" />
        </Helmet>
        <div className="animate-fade-in max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-8 font-mono">
                <Link to="/docs" className="hover:text-primary-400 transition-colors">Docs</Link>
                <span className="text-zinc-700">/</span>
                <span className="text-primary-400">Reference</span>
            </div>

            <div className="mb-12">
                <h1 className="text-4xl font-bold text-white mb-6">CLI Reference</h1>
                <p className="text-xl text-zinc-400 leading-relaxed border-l-2 border-primary-500/50 pl-6">
                    Complete reference for the <code>decide</code> command-line interface. All commands are also available as <code>decisionnode</code>.
                </p>
            </div>

            <Section title="Installation" id="installation">
                <CodeBlock code="npm install -g decisionnode" />
                <p className="text-zinc-400 mt-4">
                    Both <code>decide</code> and <code>decisionnode</code> are installed — they're the same command. <code>decide</code> is just a shorter alias. Every example in this page works with either:
                </p>
                <CodeBlock code={`decide add          # short
decisionnode add    # same thing`} />
            </Section>

            <Section title="Core Commands" id="core-commands">
                <div className="space-y-4">
                    {coreCommands.map((c) => (
                        <div key={c.cmd} className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-5">
                            <code className="text-primary-400 font-bold text-sm">{c.cmd}</code>
                            <p className="text-zinc-400 text-sm mt-2">{c.desc}</p>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Data & Maintenance" id="data-maintenance">
                <div className="space-y-4">
                    {dataCommands.map((c) => (
                        <div key={c.cmd} className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-5">
                            <code className="text-primary-400 font-bold text-sm">{c.cmd}</code>
                            <p className="text-zinc-400 text-sm mt-2">{c.desc}</p>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Web UI" id="web-ui">
                <p className="text-zinc-400 mb-4">
                    A local web interface for browsing and visualizing your decisions. Three views — graph, vector space, and list — share the same selection state and filter bar. Live MCP pulse animates which decisions the AI is touching in real time. Read-only — the CLI and MCP remain the write paths.
                </p>
                <div className="space-y-4">
                    {uiCommands.map((c) => (
                        <div key={c.cmd} className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-5">
                            <code className="text-primary-400 font-bold text-sm">{c.cmd}</code>
                            <p className="text-zinc-400 text-sm mt-2">{c.desc}</p>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Global Decisions" id="global-decisions">
                <p className="text-zinc-400 mb-4">
                    Some decisions apply across all projects — things like "always use TypeScript strict mode" or "never commit .env files". These are global decisions, stored in <code>~/.decisionnode/.decisions/_global/</code>.
                </p>
                <div className="space-y-3 text-zinc-400 text-sm">
                    <p><code className="text-primary-400">decide add --global</code> — create a global decision through the same interactive flow.</p>
                    <p><code className="text-primary-400">decide list --global</code> — list only global decisions. Without this flag, <code>decide list</code> shows both project and global together.</p>
                    <p><code className="text-primary-400">decide search</code> — automatically includes global decisions in results alongside project decisions.</p>
                </div>
                <p className="text-zinc-400 mt-4 text-sm">
                    Global decision IDs are prefixed with <code>global:</code> (e.g. <code>global:ui-001</code>). Use this prefix with <code>get</code>, <code>edit</code>, and <code>delete</code>. Editing or deleting a global decision requires extra confirmation since it affects all projects.
                </p>
                <p className="text-zinc-400 mt-2 text-sm">
                    If a project decision conflicts with a global one, the project decision takes priority.
                </p>

                <div className="mt-6 rounded-lg overflow-hidden border border-white/10">
                    <video autoPlay muted loop playsInline className="w-full">
                        <source src="/recordings/global.mp4" type="video/mp4" />
                    </video>
                </div>
            </Section>

            <Section title="Examples" id="examples">
                <div className="space-y-3">
                    <CodeBlock code={`# Interactive add
decide add

# One-command add (no prompts)
decide add -s UI -d "Use Tailwind for all styling" -r "Consistent tokens" -c "No arbitrary values"

# One-command global add
decide add --global -s Security -d "Never commit .env files"

# Search (includes global decisions)
decide search "how should we handle authentication?"

# List, filter, view
decide list --scope Backend
decide list --global
decide get global:ui-001

# Deprecate and re-activate
decide deprecate ui-003
decide activate ui-003

# Export as JSON — file is created at the path you specify
decide export json > ~/my-project-decisions.json

# Check and fix embedding health
decide check
decide embed`} />
                </div>
            </Section>
        </div>
        </>
    );
}
