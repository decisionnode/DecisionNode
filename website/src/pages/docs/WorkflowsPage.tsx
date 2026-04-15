import { Section, Steps, Step, CodeBlock } from '../../components/docs/DocsComponents';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function WorkflowsPage() {
    return (
        <>
        <Helmet>
            <title>Workflows — DecisionNode Docs</title>
            <meta name="description" content="DecisionNode workflow examples — real-world patterns for recording and retrieving decisions across AI tools." />
            <link rel="canonical" href="https://decisionnode.dev/docs/workflows" />
        </Helmet>
        <div className="animate-fade-in max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-8 font-mono">
                <Link to="/docs" className="hover:text-primary-400 transition-colors">Docs</Link>
                <span className="text-zinc-700">/</span>
                <span className="text-primary-400">Guides</span>
            </div>

            <div className="mb-12">
                <h1 className="text-4xl font-bold text-white mb-6">Common Workflows</h1>
                <p className="text-xl text-zinc-400 leading-relaxed border-l-2 border-primary-500/50 pl-6">
                    How DecisionNode fits into your day-to-day development.
                </p>
            </div>

            <Section title="Search, decide, code" id="search-decide-code">
                <p className="text-zinc-400 mb-6">
                    The basic loop: check what's already been decided, then code.
                </p>

                <Steps>
                    <Step title="1. Search before you start">
                        <p>Before working on something, check if there are existing conventions:</p>
                        <CodeBlock code={`decide search "how do we handle error logging?"`} />
                        <p>If the <Link to="/docs/mcp" className="text-primary-400 hover:underline">MCP server</Link> is connected, your AI does this automatically — the <Link to="/docs/setup#agent-behavior" className="text-primary-400 hover:underline">agent behavior</Link> setting controls how aggressively.</p>
                    </Step>

                    <Step title="2. Record decisions as you go">
                        <p>When you agree on an approach, record it — interactively or in one command:</p>
                        <CodeBlock code={`decide add
# or inline:
decide add -s UI -d "Use Tailwind" -r "Consistent tokens"`} />
                        <p>Or the AI calls <code>add_decision</code> through MCP. If a <Link to="/docs/context#conflict-detection" className="text-primary-400 hover:underline">similar decision already exists</Link>, you'll be warned before it's saved.</p>
                    </Step>

                    <Step title="3. Code">
                        <p>The next time you or a different AI session works in this area, the decisions will be there. No need to re-explain conventions.</p>
                    </Step>
                </Steps>
            </Section>

            <Section title="New AI sessions" id="new-sessions">
                <p className="text-zinc-400 mb-4">
                    Decisions persist across sessions. When you start a new AI chat, the AI searches DecisionNode before writing code (if the MCP server is connected). It picks up all existing conventions without you having to repeat anything.
                </p>
                <p className="text-zinc-400 text-sm">
                    With agent behavior set to <code>strict</code> (default), the AI is instructed to search before every code change. On <code>relaxed</code>, it searches only when it thinks it's relevant. See <Link to="/docs/mcp#agent-behavior" className="text-primary-400 hover:underline">agent behavior</Link>.
                </p>
            </Section>

            <Section title="Global decisions" id="global-decisions">
                <p className="text-zinc-400 mb-4">
                    Some decisions apply across all your projects — things like "always use TypeScript strict mode" or "never commit .env files":
                </p>
                <CodeBlock code={`decide add --global`} />
                <p className="text-zinc-400 mt-4 text-sm">
                    Global decisions are automatically included in search results for every project. If a project decision conflicts with a global one, the project decision takes priority. See <Link to="/docs/cli#global-decisions" className="text-primary-400 hover:underline">global decisions</Link> in the CLI reference.
                </p>

                <div className="mt-6 rounded-lg overflow-hidden border border-white/10">
                    <video autoPlay muted loop playsInline className="w-full">
                        <source src="/recordings/global.mp4" type="video/mp4" />
                    </video>
                </div>
            </Section>

            <Section title="Deprecating decisions" id="deprecating">
                <p className="text-zinc-400 mb-4">
                    When a convention is no longer relevant, deprecate it instead of deleting. Deprecated decisions are hidden from search but you can bring them back if you change your mind:
                </p>
                <CodeBlock code={`# Hide from search
decide deprecate ui-015

# Bring it back
decide activate ui-015`} />
                <p className="text-zinc-400 mt-4 text-sm">
                    Deprecated decisions still show up in <code>decide list</code> (marked with ⚠️). The <Link to="/docs/decisions#lifecycle" className="text-primary-400 hover:underline">embedding is preserved</Link>, so re-activating is instant. See <Link to="/docs/decisions#lifecycle" className="text-primary-400 hover:underline">lifecycle</Link>.
                </p>

                <div className="mt-6 rounded-lg overflow-hidden border border-white/10">
                    <video autoPlay muted loop playsInline className="w-full">
                        <source src="/recordings/deprecate.mp4" type="video/mp4" />
                    </video>
                </div>
            </Section>

            <Section title="Moving decisions between projects" id="migrating">
                <p className="text-zinc-400 mb-4">
                    Export from one project and import into another:
                </p>
                <CodeBlock code={`# Export — saves to a file you choose
cd old-project
decide export json > ~/decisions.json

# Import — point to that file from another project
cd new-project
decide init
decide import ~/decisions.json`} />
                <p className="text-zinc-400 mt-4 text-sm">
                    <code>decide export</code> prints to the terminal — the <code>{'>'}</code> redirects it into a file at the path you specify. Imported decisions are automatically embedded. Use <code>--global</code> on either command to export/import <Link to="/docs/cli#global-decisions" className="text-primary-400 hover:underline">global decisions</Link>.
                </p>
            </Section>

            <Section title="Reviewing history" id="history">
                <p className="text-zinc-400 mb-4">
                    Every add, update, deprecation, activation, and delete is logged — along with which tool made the change. MCP clients are identified by name (e.g. <code>claude-code</code>, <code>cursor</code>) so you can see exactly where each change came from.
                </p>
                <CodeBlock code={`# View recent activity
decide history

# Filter by source
decide history --filter mcp
decide history --filter cli`} />

                <div className="mt-6 rounded-lg overflow-hidden border border-white/10">
                    <video autoPlay muted loop playsInline className="w-full">
                        <source src="/recordings/history.mp4" type="video/mp4" />
                    </video>
                </div>
            </Section>

            <Section title="Checking embedding health" id="health">
                <p className="text-zinc-400 mb-4">
                    If you've been adding decisions without an API key, or if embedding failed for some reason, decisions won't be searchable. Check and fix:
                </p>
                <CodeBlock code={`# See which decisions are missing embeddings
decide check

# Generate embeddings for anything that's missing
decide embed

# Clean up orphaned vectors from deleted decisions
decide clean`} />

                <div className="mt-6 rounded-lg overflow-hidden border border-white/10">
                    <video autoPlay muted loop playsInline className="w-full">
                        <source src="/recordings/embed.mp4" type="video/mp4" />
                    </video>
                </div>
            </Section>

            <Section title="Visualizing your decisions" id="visualizing">
                <p className="text-zinc-400 mb-4">
                    Run <code>decide ui</code> to launch a local web interface that gives you three views over the same store: a force-directed <strong className="text-zinc-200">graph</strong> (decisions linked by semantic similarity), a 2D <strong className="text-zinc-200">vector space</strong> (UMAP projection of the 3072-dim Gemini embeddings), and a searchable <strong className="text-zinc-200">list</strong>. When an MCP client (Claude Code, Cursor, Windsurf, etc.) calls <code>search_decisions</code>, matched nodes pulse live in that client's color — you literally watch the AI think. CLI mutations (add / edit / delete) animate in too.
                </p>
                <CodeBlock code={`# Foreground (Ctrl+C to stop)
decide ui

# Background — return the terminal immediately
decide ui -d
decide ui status
decide ui stop`} />
                <p className="text-zinc-400 mt-4 text-sm">
                    The UI is read-only. The CLI and MCP server remain the only write paths into the store. Local-only HTTP server on <code>localhost:7788</code> with a fallback to a random port if it's taken.
                </p>
            </Section>
        </div>
        </>
    );
}
