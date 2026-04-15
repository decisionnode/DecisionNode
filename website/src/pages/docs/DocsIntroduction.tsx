import {
    Terminal,
    Puzzle,
    Code2,
    Zap,
    Github
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Section, Tabs, Card, CardGroup, CodeBlock } from '../../components/docs/DocsComponents';

export default function DocsIntroduction() {
    return (
        <>
        <Helmet>
            <title>Documentation — DecisionNode</title>
            <meta name="description" content="DecisionNode documentation — learn how to record structured decisions and search them semantically across all your AI coding tools." />
            <link rel="canonical" href="https://decisionnode.dev/docs" />
        </Helmet>
        <div className="animate-fade-in max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-8 font-mono">
                <Link to="/docs" className="hover:text-primary-400 transition-colors">Docs</Link>
                <span className="text-zinc-700">/</span>
                <span className="text-primary-400">Introduction</span>
            </div>

            <div className="mb-12">
                <h1 className="text-4xl font-bold text-white mb-6">Introduction</h1>
                <p className="text-xl text-zinc-400 leading-relaxed border-l-2 border-primary-500/50 pl-6">
                    Record structured decisions once, search them from all your AI coding tools — a shared structured memory store across Claude Code, Cursor, Windsurf, Antigravity, and every MCP client.
                </p>
            </div>

            <Section title="The problem" id="the-problem">
                <div className="space-y-4 text-zinc-400">
                    <p>
                        You make decisions while coding with AI — "use Tailwind, not CSS modules", "always return proper HTTP status codes", "use Vitest for testing." These decisions get scattered:
                    </p>
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        <li><strong className="text-zinc-200">Siloed per tool</strong> — a decision made in Claude Code doesn't exist in Cursor or Windsurf. Each tool has its own memory, if any.</li>
                        <li><strong className="text-zinc-200">Not semantically searchable</strong> — files like <code>CLAUDE.md</code> or <code>CURSORRULES</code> get loaded into the prompt in full. There's some directory-level scoping, but no semantic retrieval — a question about button styling still pulls in your database migration rules.</li>
                        <li><strong className="text-zinc-200">Context window pollution</strong> — as decisions grow, the file gets too large. You start deleting old decisions to make room, losing them permanently.</li>
                        <li><strong className="text-zinc-200">No history</strong> — there's no audit trail. You can't see what decisions were added, changed, or removed — or whether it was you or the AI that did it.</li>
                        <li><strong className="text-zinc-200">No structure</strong> — decisions are mixed with setup instructions, code snippets, and notes. No way to scope, filter, deprecate, or track lifecycle.</li>
                    </ul>
                </div>
            </Section>

            <Section title="What DecisionNode does" id="what-it-does">
                <div className="space-y-4 text-zinc-400">
                    <p>
                        DecisionNode stores decisions as structured JSON objects, embeds them as vectors, and exposes them over MCP so any compatible tool can search them. The same decisions are accessible from Claude Code, Cursor, Windsurf, Antigravity, or any other MCP client.
                    </p>
                    <p>
                        Retrieval is <strong className="text-zinc-200">explicit</strong> — the AI calls <code>search_decisions</code> through MCP when it needs context. Only the relevant matches come back, ranked by cosine similarity. Nothing gets injected into the prompt blindly.
                    </p>

                    <div className="bg-zinc-900/50 p-6 rounded-lg border border-zinc-800 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div>
                                <p className="text-zinc-500 font-semibold mb-2">Flat markdown files</p>
                                <ul className="space-y-1 text-zinc-500">
                                    <li>Loaded in full — some directory-level scoping, but no semantic retrieval</li>
                                    <li>No search — or keyword matching at best</li>
                                    <li>No structure, scoping, or lifecycle</li>
                                    <li>No change history or audit trail</li>
                                    <li>Siloed to one tool</li>
                                </ul>
                            </div>
                            <div>
                                <p className="text-zinc-200 font-semibold mb-2">DecisionNode</p>
                                <ul className="space-y-1 text-zinc-300">
                                    <li>Only relevant decisions retrieved</li>
                                    <li>Semantic vector search (cosine similarity)</li>
                                    <li>Scoped, structured, deprecate/activate lifecycle</li>
                                    <li>Activity history — who changed what, from which tool (e.g. <code>claude-code</code>, <code>cursor</code>)</li>
                                    <li>Same store across all MCP clients</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="How it works" id="how-it-works">
                <div className="space-y-4 text-zinc-400">
                    <p>
                        <strong className="text-zinc-200">1. Record a decision</strong> — via the CLI (<code>decide add</code>) or the AI calls <code>add_decision</code> through MCP when you agree on an approach during a conversation.
                    </p>
                    <p>
                        <strong className="text-zinc-200">2. Embedding</strong> — the decision text is converted to a vector embedding using Gemini's <code>gemini-embedding-001</code> model, then stored locally in <code>vectors.json</code>. No external vector database required.
                    </p>
                    <p>
                        <strong className="text-zinc-200">3. Retrieval</strong> — when the AI needs context, it calls <code>search_decisions</code> via MCP. The query is embedded and compared against stored vectors using cosine similarity. The top matches are returned with their similarity scores.
                    </p>
                </div>
            </Section>

            <Section title="Three interfaces" id="three-interfaces">
                <div className="space-y-4 text-zinc-400">
                    <p>
                        DecisionNode has three interfaces that share the same local store:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="bg-zinc-900/50 p-5 rounded-lg border border-zinc-800">
                            <p className="text-zinc-200 font-semibold mb-2">CLI — for you</p>
                            <p className="text-sm">The <code>decide</code> command. Use it to set up projects, add decisions, search, export/import, check embedding health, and configure settings. Supports interactive prompts or <Link to="/docs/cli#core-commands" className="text-primary-400 hover:underline">one-command inline flags</Link>.</p>
                        </div>
                        <div className="bg-zinc-900/50 p-5 rounded-lg border border-zinc-800">
                            <p className="text-zinc-200 font-semibold mb-2">MCP server — for your AI</p>
                            <p className="text-sm">The <code>decide-mcp</code> binary. Connect it once (e.g. <code>claude mcp add decisionnode -s user decide-mcp</code> for Claude Code) and the AI calls tools like <code>search_decisions</code> and <code>add_decision</code> over <a href="https://modelcontextprotocol.io" className="text-primary-400 hover:underline" target="_blank" rel="noopener noreferrer">MCP</a>. Works with Claude Code, Cursor, Windsurf, Antigravity, or any MCP-compliant tool.</p>
                        </div>
                        <div className="bg-zinc-900/50 p-5 rounded-lg border border-zinc-800">
                            <p className="text-zinc-200 font-semibold mb-2">Web UI — for visualization</p>
                            <p className="text-sm">Run <code>decide ui</code> to launch a local web interface with three views: a <strong className="text-zinc-200">force-directed graph</strong>, a <strong className="text-zinc-200">vector space</strong> (UMAP projection of the 3072-dim embeddings), and a <strong className="text-zinc-200">searchable list</strong>. When an AI client searches via MCP, matched nodes pulse live in that client's color. Read-only — CLI and MCP remain the write paths.</p>
                        </div>
                    </div>
                    <p className="text-sm mt-4">
                        All three read and write to the same store (<code>~/.decisionnode/</code>). The CLI handles setup and maintenance, the MCP server handles the AI's workflow with structured JSON and <Link to="/docs/context#conflict-detection" className="text-primary-400 hover:underline">automatic conflict detection</Link>, and the Web UI gives you a visual layer over both. See the <Link to="/docs/mcp#setup" className="text-primary-400 hover:underline">MCP setup guide</Link> to connect your AI client.
                    </p>
                </div>
            </Section>

            <Section title="Quick install" id="quick-install">
                <Tabs
                    tabs={[
                        {
                            id: 'npm',
                            label: 'NPM (Recommended)',
                            content: (
                                <div>
                                    <p className="text-zinc-400 text-sm mb-3">Install globally:</p>
                                    <CodeBlock code="npm install -g decisionnode" />
                                </div>
                            )
                        },
                        {
                            id: 'npx',
                            label: 'NPX',
                            content: (
                                <div>
                                    <p className="text-zinc-400 text-sm mb-3">Run without installing:</p>
                                    <CodeBlock code="npx decisionnode help" />
                                </div>
                            )
                        }
                    ]}
                />

                <div className="mt-8">
                    <CodeBlock code={`cd your-project\ndecide init\ndecide setup  # configure your Gemini API key`} />
                    <p className="text-zinc-400 mt-4 text-sm">
                        See the <Link to="/docs/quickstart" className="text-primary-400 hover:underline">Quickstart</Link> for a full walkthrough, or the <Link to="/docs/mcp" className="text-primary-400 hover:underline">MCP Server</Link> page to connect your AI client.
                    </p>
                </div>
            </Section>

            <Section title="Next steps">
                <CardGroup cols={2}>
                    <Card title="Quickstart" icon={<Zap className="w-5 h-5" />} to="/docs/quickstart">
                        Install, capture a decision, and search — in under a minute
                    </Card>
                    <Card title="Decision Nodes" icon={<Code2 className="w-5 h-5" />} to="/docs/decisions">
                        How decisions are structured, scoped, and tracked
                    </Card>
                    <Card title="Context Engine" icon={<Puzzle className="w-5 h-5" />} to="/docs/context">
                        How the local RAG engine embeds and retrieves decisions
                    </Card>
                    <Card title="MCP Server" icon={<Terminal className="w-5 h-5" />} to="/docs/mcp">
                        Connect your AI client to DecisionNode
                    </Card>
                </CardGroup>
            </Section>

            <Section title="Resources">
                <CardGroup cols={2}>
                    <Card title="MCP Protocol" icon={<Puzzle className="w-5 h-5" />} href="https://modelcontextprotocol.io">
                        The underlying protocol specification
                    </Card>
                    <Card title="GitHub" icon={<Github className="w-5 h-5" />} href="https://github.com/decisionnode/decisionnode">
                        Source code and issue tracker
                    </Card>
                </CardGroup>
            </Section>
        </div>
        </>
    );
}
