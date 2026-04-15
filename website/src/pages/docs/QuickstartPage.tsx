import { Terminal } from 'lucide-react';
import { Section, CodeBlock, Steps, Step, Card, CardGroup } from '../../components/docs/DocsComponents';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function QuickstartPage() {
    return (
        <>
        <Helmet>
            <title>Quickstart — DecisionNode Docs</title>
            <meta name="description" content="Get started with DecisionNode in minutes — install, configure, and record your first decision." />
            <link rel="canonical" href="https://decisionnode.dev/docs/quickstart" />
        </Helmet>
        <div className="animate-fade-in max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-8 font-mono">
                <Link to="/docs" className="hover:text-primary-400 transition-colors">Docs</Link>
                <span className="text-zinc-700">/</span>
                <span className="text-primary-400">Quickstart</span>
            </div>

            <div className="mb-12">
                <h1 className="text-4xl font-bold text-white mb-6">Quickstart Guide</h1>
                <p className="text-xl text-zinc-400 leading-relaxed border-l-2 border-primary-500/50 pl-6">
                    Initialize DecisionNode, record your first decision, and search for it — all in under a minute.
                </p>
            </div>

            <Steps>
                <Step title="Install and initialize">
                    <CodeBlock code={`npm install -g decisionnode
cd your-project
decide init`} />
                    <p>
                        This registers your project in the global decision store at <code>~/.decisionnode/.decisions/</code>.
                    </p>
                </Step>

                <Step title="Set up your API key">
                    <p>
                        Semantic search requires a Gemini API key (free tier available). Run setup and paste your key when prompted:
                    </p>
                    <CodeBlock code="decide setup" />
                    <p>
                        Get a free key from <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener" className="text-primary-400 hover:underline">Google AI Studio</a>, then paste it in. The key is saved automatically to <code>~/.decisionnode/.env</code>.
                    </p>
                </Step>

                <Step title="Capture your first decision">
                    <CodeBlock code="decide add" />
                    <p className="mb-3">
                        The CLI prompts you for:
                    </p>
                    <ul className="list-disc list-inside text-zinc-400 mb-4 ml-4 space-y-1 text-sm">
                        <li><strong className="text-zinc-200">Scope</strong> — the architectural domain this decision belongs to (e.g. UI, Backend, API, Security, Infrastructure). Scopes group related decisions together — each scope becomes its own JSON file.</li>
                        <li><strong className="text-zinc-200">Decision</strong> — a clear, actionable statement of what was decided.</li>
                        <li><strong className="text-zinc-200">Rationale</strong> <span className="text-zinc-600">(optional)</span> — the reasoning behind the decision.</li>
                        <li><strong className="text-zinc-200">Constraints</strong> <span className="text-zinc-600">(optional)</span> — specific rules that must be followed, comma-separated.</li>
                    </ul>
                    <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 font-mono text-sm text-zinc-400">
                        <span className="text-zinc-500">Scope (e.g., UI, Backend, API):</span> <span className="text-cyan-400">UI</span><br />
                        <span className="text-zinc-500">Decision:</span> <span className="text-white">Use Tailwind CSS for all styling</span><br />
                        <span className="text-zinc-500">Rationale (optional):</span> <span className="text-white">Consistent design tokens, easy for AI to generate correct classes</span><br />
                        <span className="text-zinc-500">Constraints (optional):</span> <span className="text-white">No arbitrary values like w-[37px], use @apply only for base components</span>
                    </div>
                    <p className="text-zinc-400 mt-4 text-sm">
                        You can also skip the prompts and add in one command:
                    </p>
                    <CodeBlock code={`decide add -s UI -d "Use Tailwind CSS for all styling" -r "Consistent tokens" -c "No arbitrary values"`} />
                    <div className="mt-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 text-sm text-zinc-400">
                        <strong className="text-yellow-400">Getting an API key error?</strong> If you see <code className="text-xs">API_KEY_INVALID</code> or <code className="text-xs">API Key not found</code> after adding a decision, your Gemini API key is missing or incorrect. Run <code>decide setup</code> to set a valid key. The decision is still saved — only the auto-embedding step fails, and you can re-embed later with <code>decide embed</code>.
                    </div>
                </Step>

                <Step title="Verify it was saved">
                    <CodeBlock code="decide list" />
                    <p>
                        You should see your decision listed under the UI scope with its ID (e.g. <code>ui-001</code>).
                    </p>
                </Step>

                <Step title="Search for it">
                    <CodeBlock code={`decide search "how should we style components?"`} />
                    <p>
                        DecisionNode embeds your query and compares it against stored decisions using cosine similarity. Your Tailwind decision should come back as the top match.
                    </p>
                </Step>

                <Step title="Connect your AI client">
                    <p className="mb-3">
                        For Claude Code, run this once to register the MCP server:
                    </p>
                    <CodeBlock code="claude mcp add decisionnode -s user decide-mcp" />
                    <p className="mt-3">
                        Restart Claude Code after running this. Your AI can now call <code>search_decisions</code> before writing code and <code>add_decision</code> when you agree on a new approach. For other clients, see the <Link to="/docs/mcp#setup" className="text-primary-400 hover:underline">MCP setup guide</Link>.
                    </p>
                </Step>

                <Step title="Visualize it">
                    <p className="mb-3">
                        Launch the local web UI to see your decisions as a graph, a 2D vector space, and a searchable list:
                    </p>
                    <CodeBlock code="decide ui" />
                    <p className="mt-3">
                        The UI auto-opens at <code>http://localhost:7788</code>. When your AI client searches via MCP, matched decisions pulse live in that client's color. Use <code>decide ui -d</code> to run it in the background and reclaim your terminal.
                    </p>
                </Step>
            </Steps>

            <Section title="What's Next?">
                <CardGroup cols={2}>
                    <Card title="CLI Reference" icon={<Terminal className="w-5 h-5" />} to="/docs/cli">
                        See all available commands
                    </Card>
                    <Card title="MCP Server" icon={<Terminal className="w-5 h-5" />} to="/docs/mcp">
                        Connect your AI agents to your decisions
                    </Card>
                </CardGroup>
            </Section>
        </div>
        </>
    );
}
