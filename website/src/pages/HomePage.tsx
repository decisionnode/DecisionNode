import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Terminal, Code2, Sparkles, Copy, Check, Eye, Play, Pause, Maximize, RotateCcw, Search, Cable, SlidersHorizontal, Globe, History, ShieldAlert, ToggleLeft, ArrowUpDown, HeartPulse } from 'lucide-react';

import decisionNodeBlue from '../assets/images/DecisionNode-transparent-Blue.png';
import decisionNodeYellow from '../assets/images/DecisionNode-transparent-Yellow.png';

export default function HomePage() {
    const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState(2);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onTimeUpdate = () => setProgress((video.currentTime / video.duration) * 100 || 0);
        video.addEventListener('timeupdate', onTimeUpdate);
        return () => video.removeEventListener('timeupdate', onTimeUpdate);
    }, []);

    function togglePlay() {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { v.play(); setIsPlaying(true); }
        else { v.pause(); setIsPlaying(false); }
    }

    function cycleSpeed() {
        const v = videoRef.current;
        if (!v) return;
        const speeds = [1, 1.5, 2, 3];
        const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
        v.playbackRate = next;
        setSpeed(next);
    }

    function seekVideo(e: React.MouseEvent<HTMLDivElement>) {
        const v = videoRef.current;
        if (!v) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        v.currentTime = pct * v.duration;
    }

    const playerRef = useRef<HTMLDivElement>(null);

    function goFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            playerRef.current?.requestFullscreen();
        }
    }

    function restart() {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = 0;
        v.play();
        setIsPlaying(true);
    }

    function copyCommand(command: string) {
        navigator.clipboard.writeText(command);
        setCopiedCommand(command);
        setTimeout(() => setCopiedCommand(null), 2000);
    }

    return (
        <>
            <Helmet>
                <title>DecisionNode</title>
                <meta name="description" content="Record structured decisions once, search them from all your AI coding tools — a shared structured memory store across Claude Code, Cursor, Windsurf, Antigravity, and every MCP client." />
                <link rel="canonical" href="https://decisionnode.dev" />
            </Helmet>
            <div className="relative min-h-screen overflow-hidden">

                {/* Hero */}
                <section className="relative pt-28 pb-20 border-b border-white/5 overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none z-0 hidden md:block">
                        <div className="absolute top-20 left-[20%] w-72 h-72 bg-primary-500/15 rounded-full blur-[100px] animate-pulse-slow" />
                        <div className="absolute top-40 right-[20%] w-96 h-96 bg-accent-500/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
                    </div>

                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 animate-slide-up">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 text-xs font-mono mb-8">
                            <span className="text-primary-400">npm i -g decisionnode</span>
                        </div>

                        <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-white leading-tight">
                            One decision layer
                            <br />
                            for all your AI tools.
                        </h1>

                        <p className="text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto mb-10 leading-relaxed">
                            Record structured decisions once, search them from all your AI coding tools.<br />
                            A shared structured memory store across Claude Code, Cursor, Windsurf, Antigravity, and every MCP client.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a href="#install" className="btn-primary flex items-center justify-center gap-2 group px-6 py-3">
                                Get Started
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </a>
                            <Link to="/docs" className="btn-secondary flex items-center justify-center gap-2 px-6 py-3">
                                Read the Docs
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Demo video */}
                <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 mb-20 relative z-20">
                    <div ref={playerRef} className="rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/50 md:backdrop-blur-md shadow-2xl relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary-500/20 to-accent-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none hidden md:block" />
                        <div className="relative z-10">
                            {/* Terminal title bar */}
                            <div className="px-4 py-2 bg-zinc-900/80 border-b border-white/5 flex items-center gap-2">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                                </div>
                            </div>

                            {/* Video with custom controls on desktop, native controls on mobile */}
                            <video
                                ref={videoRef}
                                className="w-full cursor-pointer hidden md:block"
                                autoPlay
                                muted
                                loop
                                playsInline
                                onClick={togglePlay}
                                onLoadedData={(e) => { (e.target as HTMLVideoElement).playbackRate = 2; }}
                            >
                                <source src="/recordings/demo.mp4" type="video/mp4" />
                            </video>

                            {/* Mobile video with native controls */}
                            <video
                                className="w-full md:hidden"
                                controls
                                controlsList="nodownload"
                                autoPlay
                                muted
                                loop
                                playsInline
                                onLoadedData={(e) => { (e.target as HTMLVideoElement).playbackRate = 2; }}
                                onPlay={(e) => { (e.target as HTMLVideoElement).playbackRate = 2; }}
                            >
                                <source src="/recordings/demo.mp4" type="video/mp4" />
                            </video>

                            {/* Custom controls (desktop only) */}
                            <div className="hidden md:flex px-4 py-2 bg-zinc-900/80 border-t border-white/5 items-center gap-3">
                                <button onClick={togglePlay} className="text-zinc-400 hover:text-white transition-colors">
                                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </button>
                                <button onClick={restart} className="text-zinc-400 hover:text-white transition-colors">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>

                                {/* Progress bar */}
                                <div className="flex-1 h-1 bg-zinc-700 rounded-full cursor-pointer group" onClick={seekVideo}>
                                    <div
                                        className="h-full bg-primary-500 rounded-full relative transition-all"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>

                                {/* Speed button */}
                                <button
                                    onClick={cycleSpeed}
                                    className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                                >
                                    {speed}x
                                </button>

                                <button onClick={goFullscreen} className="text-zinc-400 hover:text-white transition-colors">
                                    <Maximize className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Works with */}
                {/* TODO: Add real logos once trademark permissions are secured */}
                <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-b border-white/5 relative z-10">
                    <p className="text-center text-zinc-500 text-sm mb-6">Compatible with</p>
                    <div className="flex flex-wrap justify-center gap-6 md:gap-10">
                        {[
                            { name: 'Claude Code', icon: Terminal },
                            { name: 'Cursor', icon: Code2 },
                            { name: 'Windsurf', icon: Sparkles },
                            { name: 'Antigravity', icon: Cable },
                        ].map((tool) => (
                            <div key={tool.name} className="flex items-center gap-2 text-zinc-400">
                                <tool.icon className="w-4 h-4 text-zinc-500" />
                                <span className="text-sm">{tool.name}</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 text-zinc-500">
                            <span className="text-sm">+ any MCP client</span>
                        </div>
                    </div>
                </section>

                {/* How it works — the actual flow */}
                <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-b border-white/5 relative z-10">
                    <h2 className="text-2xl font-bold text-white mb-3 text-center">What happens under the hood</h2>
                    <p className="text-zinc-500 text-center mb-12 max-w-2xl mx-auto">
                        From recording a decision to the AI retrieving it in a future session.
                    </p>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Step 1 */}
                        <div className="bento-card p-6 relative group">
                            <div className="text-4xl font-bold text-zinc-800/50 absolute top-3 right-4">1</div>
                            <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-4 p-1 select-none">
                                <img src={decisionNodeBlue} alt="" className="w-full h-full object-contain brightness-110 pointer-events-none" draggable={false} onContextMenu={(e) => e.preventDefault()} />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">A decision is made</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-3">
                                During a conversation, you and your AI agree: "use our custom dropdown, not the native one." The AI records it via MCP, or you run <code className="text-primary-400 text-xs">decide add</code>.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="bento-card p-0 relative group overflow-hidden md:col-span-2 lg:col-span-1">
                            <div className="p-6 pb-2">
                                <div className="text-4xl font-bold text-zinc-800/50 absolute top-3 right-4">2</div>
                                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-4 p-1 select-none">
                                    <img src={decisionNodeYellow} alt="" className="w-full h-full object-contain brightness-110 pointer-events-none" draggable={false} onContextMenu={(e) => e.preventDefault()} />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Stored as structured JSON</h3>
                                <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                                    Not a line in a markdown file. A typed object with scope, rationale, and constraints.
                                </p>
                            </div>

                            <div className="bg-zinc-950/50 border-t border-white/5 p-4 font-mono text-[10px] leading-relaxed text-zinc-500 overflow-hidden relative">
                                <div className="absolute inset-0 bg-yellow-500/5 blur-2xl rounded-full translate-y-10" />
                                <div className="relative z-10 space-y-1">
                                    <div className="text-yellow-500/80">{"{"}</div>
                                    <div className="pl-4">
                                        <span className="text-zinc-400">id:</span> <span className="text-green-400">"ui-009"</span>,<br />
                                        <span className="text-zinc-400">scope:</span> <span className="text-yellow-500">"UI"</span>,<br />
                                        <span className="text-zinc-400">decision:</span> <span className="text-white">"Use custom ScopeSelector instead of native datalist"</span>,<br />
                                        <span className="text-zinc-400">rationale:</span> <span className="text-zinc-500">"Native datalists differ across browsers"</span>,<br />
                                        <span className="text-zinc-400">constraints:</span> [ <span className="text-green-400">"Must match dark theme"</span> ]<br />
                                    </div>
                                    <div className="text-yellow-500/80">{"}"}</div>
                                </div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="bento-card p-6 relative group">
                            <div className="text-4xl font-bold text-zinc-800/50 absolute top-3 right-4">3</div>
                            <div className="w-10 h-10 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-center justify-center mb-4 text-accent-400">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Embedded as a vector</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-3">
                                The decision text is converted to a vector using Gemini's <code className="text-zinc-300 text-xs">gemini-embedding-001</code> and stored locally in <code className="text-zinc-300 text-xs">vectors.json</code>.
                            </p>
                        </div>

                        {/* Step 4 */}
                        <div className="bento-card p-6 relative group">
                            <div className="text-4xl font-bold text-zinc-800/50 absolute top-3 right-4">4</div>
                            <div className="w-10 h-10 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-4 text-primary-400">
                                <Terminal className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Later: AI needs context</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-3">
                                New session: "Build me a settings form with a dropdown." The AI calls <code className="text-primary-400 text-xs">search_decisions</code> through MCP before writing code.
                            </p>
                        </div>

                        {/* Step 5 */}
                        <div className="bento-card p-6 relative group">
                            <div className="text-4xl font-bold text-zinc-800/50 absolute top-3 right-4">5</div>
                            <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4 text-orange-400">
                                <Eye className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Cosine similarity match</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-3">
                                The query is embedded and compared against stored vectors. Closest decisions come back with a similarity score.
                            </p>
                            <div className="text-xs text-zinc-400 font-mono">
                                ui-009: "Use custom ScopeSelector..." <span className="text-green-400">94%</span>
                            </div>
                        </div>

                        {/* Step 6 */}
                        <div className="bento-card p-6 relative group">
                            <div className="text-4xl font-bold text-zinc-800/50 absolute top-3 right-4">6</div>
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4 text-green-400">
                                <Check className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">AI follows the decision</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-3">
                                It sees <span className="text-zinc-200">ui-009</span> and uses <code className="text-xs">ScopeSelector</code> instead of a native datalist. The decision you made weeks ago is still there.
                            </p>
                        </div>
                    </div>

                    <div className="mt-10 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 max-w-2xl mx-auto">
                        <p className="text-center text-zinc-400 text-sm">
                            Retrieval is <span className="text-primary-400">explicit</span> — the AI calls the MCP tool to search. Decisions aren't injected into the system prompt.
                        </p>
                    </div>
                </section>

                {/* What else it does */}
                <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-b border-white/5 relative z-10">
                    <h2 className="text-2xl font-bold text-white mb-3 text-center">What else it does</h2>
                    <p className="text-zinc-500 text-center mb-12 max-w-2xl mx-auto">
                        Beyond add and search — there's more under the surface.
                    </p>

                    <div className="grid grid-cols-1 gap-6 max-w-3xl mx-auto">
                        {[
                            {
                                icon: Eye,
                                title: 'Web UI — graph, vector space, list',
                                description: 'Run decide ui to launch a local web interface with three views: a force-directed graph (decisions linked by similarity), a 2D vector space (UMAP projection of the 3072-dim embeddings), and a searchable list. When an MCP client searches, matched nodes pulse live in that client\'s color — watch your AI think in real time.',
                                color: 'primary',
                                link: '/docs/cli#web-ui',
                            },
                            {
                                icon: Terminal,
                                title: 'Agent Behavior',
                                description: 'Changes the search_decisions tool description sent to the AI. Strict makes it mandatory, relaxed leaves it to the AI\'s judgment.',
                                color: 'accent',
                                video: '/recordings/behavior.mp4',
                            },
                            {
                                icon: SlidersHorizontal,
                                title: 'Configurable Threshold',
                                description: 'Set a minimum similarity score so irrelevant results get filtered out. Adjustable globally.',
                                color: 'yellow',
                                video: '/recordings/threshold.mp4',
                            },
                            {
                                icon: Globe,
                                title: 'Global Decisions',
                                description: 'Some decisions apply everywhere — "never commit .env files." Global decisions show up in every project\'s search.',
                                color: 'green',
                                video: '/recordings/global.mp4',
                            },
                            {
                                icon: History,
                                title: 'History Tracking',
                                description: 'Full audit log — what changed, when, and which tool did it. Shows the actual client name (e.g. claude-code, cursor) not just "MCP".',
                                color: 'orange',
                                video: '/recordings/history.mp4',
                            },
                            {
                                icon: ShieldAlert,
                                title: 'Conflict Detection',
                                description: 'Before adding a decision, existing ones are checked at 75% similarity. Catches near-duplicates and contradictions.',
                                color: 'red',
                                video: '/recordings/conflict.mp4',
                            },
                            {
                                icon: ToggleLeft,
                                title: 'Deprecate / Activate',
                                description: 'Soft-delete a decision without losing its embedding. Reactivate it later and it\'s immediately searchable again.',
                                color: 'purple',
                                video: '/recordings/deprecate.mp4',
                            },
                            {
                                icon: HeartPulse,
                                title: 'Embedding Health',
                                description: 'Check which decisions are missing embeddings and fix them. Keep your search index healthy.',
                                color: 'primary',
                                video: '/recordings/embed.mp4',
                            },
                            {
                                icon: Cable,
                                title: 'Cross-Tool via MCP',
                                description: 'Decisions are stored locally and exposed over MCP. Any compatible client reads the same data.',
                                color: 'accent',
                                link: '/docs/mcp',
                            },
                        ].map((feature) => {
                            const colorMap: Record<string, string> = {
                                primary: 'bg-primary-500/10 border-primary-500/20 text-primary-400',
                                accent: 'bg-accent-500/10 border-accent-500/20 text-accent-400',
                                yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
                                green: 'bg-green-500/10 border-green-500/20 text-green-400',
                                orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
                                red: 'bg-red-500/10 border-red-500/20 text-red-400',
                                purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
                                zinc: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',
                            };
                            return (
                                <div key={feature.title} className="bento-card p-0 group overflow-hidden">
                                    <div className="p-6">
                                        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${colorMap[feature.color]}`}>
                                            <feature.icon className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                                        <p className="text-zinc-400 text-sm leading-relaxed">{feature.description}</p>
                                        {'link' in feature && feature.link && (
                                            <Link to={feature.link} className="inline-block mt-3 text-xs text-zinc-500 hover:text-primary-400 transition-colors">
                                                Setup guide →
                                            </Link>
                                        )}
                                    </div>
                                    {'video' in feature && feature.video && (
                                        <div className="border-t border-white/5">
                                            <video
                                                className="w-full"
                                                autoPlay
                                                muted
                                                loop
                                                playsInline
                                                onLoadedData={(e) => { (e.target as HTMLVideoElement).playbackRate = 1.5; }}
                                            >
                                                <source src={feature.video} type="video/mp4" />
                                            </video>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-center mt-10">
                        <Link to="/docs" className="text-sm text-zinc-500 hover:text-primary-400 transition-colors">
                            Read the full docs →
                        </Link>
                    </p>
                </section>

                {/* CLI + MCP + UI */}
                <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-b border-white/5 relative z-10">
                    <h2 className="text-2xl font-bold text-white mb-3 text-center">Three interfaces, one store</h2>
                    <p className="text-zinc-500 text-center mb-12 max-w-2xl mx-auto">
                        CLI for terminal control. MCP server for your AI. Web UI for visualization. All three read and write to the same local store.
                    </p>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bento-card p-6 group hover:border-primary-500/30 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 flex-shrink-0">
                                    <Terminal className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1">CLI</h3>
                                    <p className="text-zinc-400 text-sm mb-3">
                                        <code className="text-primary-400">decide add</code>,{' '}
                                        <code className="text-primary-400">search</code>,{' '}
                                        <code className="text-primary-400">list</code>,{' '}
                                        <code className="text-primary-400">deprecate</code>,{' '}
                                        <code className="text-primary-400">export</code>.
                                        Setup, maintenance, and direct interaction from your terminal.
                                    </p>
                                    <Link to="/docs/cli" className="text-xs text-zinc-500 hover:text-primary-400 transition-colors">
                                        CLI Reference →
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="bento-card p-6 group hover:border-zinc-500/30 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-zinc-700/50 border border-zinc-600/50 flex items-center justify-center text-zinc-300 flex-shrink-0">
                                    <Code2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1">MCP Server</h3>
                                    <p className="text-zinc-400 text-sm mb-3">
                                        9 tools over the Model Context Protocol. Works with Claude Code, Cursor, Windsurf, Antigravity, and more.
                                    </p>
                                    <Link to="/docs/mcp" className="text-xs text-zinc-500 hover:text-primary-400 transition-colors">
                                        MCP Server docs →
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="bento-card p-6 group hover:border-accent-500/30 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400 flex-shrink-0">
                                    <Eye className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1">Web UI</h3>
                                    <p className="text-zinc-400 text-sm mb-3">
                                        <code className="text-accent-400">decide ui</code> launches a local interface with three views — graph, vector space, and list. Live MCP pulse animates AI activity.
                                    </p>
                                    <Link to="/docs/cli#web-ui" className="text-xs text-zinc-500 hover:text-accent-400 transition-colors">
                                        UI commands →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Install */}
                <section id="install" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-b border-white/5 relative z-10">
                    <h2 className="text-2xl font-bold text-white mb-3 text-center">Install</h2>
                    <p className="text-zinc-500 text-center mb-10">
                        Install, initialize, and connect your AI.
                    </p>

                    <div className="space-y-4 max-w-2xl mx-auto">
                        {[
                            { label: 'Install the CLI', command: 'npm install -g decisionnode' },
                            { label: 'Initialize in your project', command: 'cd your-project && decide init' },
                            { label: 'Set up your Gemini API key (free)', command: 'decide setup' },
                            { label: 'Connect to your AI (e.g. Claude Code)', command: 'claude mcp add decisionnode -s user decide-mcp' },
                        ].map((step, i) => (
                            <div key={i} className="bento-card p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-zinc-500">{i + 1}. {step.label}</span>
                                    <button
                                        onClick={() => copyCommand(step.command)}
                                        className="text-zinc-600 hover:text-zinc-300 transition-colors p-1"
                                    >
                                        {copiedCommand === step.command ? (
                                            <Check className="w-4 h-4 text-green-400" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                                <code className="text-primary-400 text-sm font-mono">{step.command}</code>
                            </div>
                        ))}
                    </div>

                    <p className="text-center text-zinc-500 text-sm mt-8">
                        Restart your AI client after connecting.
                        <Link to="/docs/mcp" className="text-primary-400 hover:text-primary-300 ml-1">
                            Setup for other clients →
                        </Link>
                    </p>
                </section>

                {/* Open source + Contributing */}
                <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 mb-10 text-center relative z-10">
                    <h2 className="text-2xl font-bold text-white mb-4">
                        Open source, MIT licensed
                    </h2>
                    <p className="text-zinc-400 max-w-xl mx-auto mb-4">
                        Everything runs locally. Decisions stay on your machine. The only external call is to Gemini's embedding API (free tier).
                    </p>
                    <p className="text-zinc-500 max-w-xl mx-auto mb-8 text-sm">
                        If you find it useful or have ideas, contributions are welcome.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <a
                            href="https://github.com/decisionnode/decisionnode"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:border-white/20 transition-all text-sm font-medium"
                        >
                            Contribute on GitHub
                            <ArrowRight className="w-4 h-4" />
                        </a>
                        <a
                            href="https://www.npmjs.com/package/decisionnode"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:border-white/20 transition-all text-sm font-medium"
                        >
                            View on npm
                            <ArrowRight className="w-4 h-4" />
                        </a>
                    </div>
                </section>
            </div>
        </>
    );
}
