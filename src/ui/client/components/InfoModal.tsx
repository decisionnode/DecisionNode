import { useEffect, useState } from 'preact/hooks';

interface InfoModalProps {
    open: boolean;
    onClose: () => void;
}

type InfoTab = 'graph' | 'vector' | 'list';

interface TabContent {
    id: InfoTab;
    label: string;
    accent: string;
    accentBg: string;
    accentRing: string;
    icon: preact.JSX.Element;
    headline: string;
    description: string;
    bullets: { label: string; body: string }[];
}

const TABS: TabContent[] = [
    {
        id: 'graph',
        label: 'Graph',
        accent: '#38bdf8',
        accentBg: 'bg-primary-500/15',
        accentRing: 'ring-primary-500/30',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
        ),
        headline: 'Decisions linked by similarity',
        description:
            "Every decision is a node. An edge connects two decisions when their embeddings are semantically similar — past the threshold you control with the slider. Force-directed layout means clusters of related decisions naturally pull together. Hover a node to see its neighborhood; click to open it.",
        bullets: [
            { label: 'Best for', body: 'Spotting clusters, finding orphan decisions, exploring how topics connect' },
            { label: 'Threshold', body: 'Drag the slider at the bottom to tighten or loosen the network' },
            { label: 'Conflict ring', body: 'A red halo around a node means it has another decision >75% similar — possible duplicate' },
            { label: 'Hover', body: 'Highlights the node and its direct neighbors, fades everything else' },
        ],
    },
    {
        id: 'vector',
        label: 'Vector Space',
        accent: '#facc15',
        accentBg: 'bg-accent-500/15',
        accentRing: 'ring-accent-500/30',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
        ),
        headline: '3072 dimensions, projected to 2',
        description:
            "Gemini embeds each decision as a 3072-dimensional vector. UMAP collapses those vectors into a 2D plane while preserving local structure — decisions that are close in meaning end up close in space. Each one is drawn as a vector radiating from origin, so you can see both magnitude and direction at a glance.",
        bullets: [
            { label: 'Best for', body: "Watching natural clusters form as your decision corpus grows" },
            { label: 'Search rays', body: 'Type a query in the top bar — animated rays fan out from origin to the closest matches' },
            { label: 'Pan / zoom', body: 'Drag to pan, scroll to zoom in and explore dense areas' },
            { label: 'Live pulse', body: 'When an MCP client searches, matched orbs glow in that client\'s color' },
        ],
    },
    {
        id: 'list',
        label: 'List',
        accent: '#a78bfa',
        accentBg: 'bg-violet-500/15',
        accentRing: 'ring-violet-500/30',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
        ),
        headline: 'Just read your decisions',
        description:
            "The boring-but-essential view. Cards grouped by scope, sorted by most recently updated. Filter by text or status; click a card to open the side panel with full rationale, constraints, and timeline. The scope dot blends colors of every creator (CLI, claude-code, cursor…) that contributed decisions in that scope.",
        bullets: [
            { label: 'Best for', body: 'Reading decisions in their original form, scanning by scope' },
            { label: 'Card colors', body: "Each card's accent matches the tool that created it — yellow for CLI, cyan for claude-code, etc." },
            { label: 'Group dots', body: 'Conic-gradient blend of all creators in that scope group' },
            { label: 'Filters', body: 'The shared filter bar above narrows the list and dims unmatched nodes in the other views' },
        ],
    },
];

export function InfoModal({ open, onClose }: InfoModalProps) {
    const [tab, setTab] = useState<InfoTab>('graph');

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    const active = TABS.find((t) => t.id === tab) ?? TABS[0];

    return (
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md animate-fade-in"
            onClick={onClose}
        >
            <div
                class="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/70 animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top accent strip — tinted by active tab */}
                <div
                    class="h-[2px] transition-colors duration-500"
                    style={{
                        background: `linear-gradient(90deg, transparent, ${active.accent}, transparent)`,
                    }}
                />

                {/* Ambient glow tinted by active tab */}
                <div
                    class="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-40 transition-opacity duration-500"
                    style={{
                        background: `radial-gradient(ellipse at top, ${active.accent}40, transparent 70%)`,
                    }}
                />

                {/* Header */}
                <div class="relative flex items-start justify-between gap-3 px-8 pt-7 pb-2">
                    <div>
                        <div class="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                            What am I looking at?
                        </div>
                        <div class="mt-2 text-2xl font-bold tracking-tight text-zinc-50">
                            Three views of your decisions
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 text-zinc-500 transition hover:border-white/15 hover:bg-white/5 hover:text-zinc-100"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Tab nav */}
                <div class="relative px-8 pb-6 pt-5">
                    <div class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/60 p-1">
                        {TABS.map((t) => {
                            const isActive = t.id === tab;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setTab(t.id)}
                                    class={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ${
                                        isActive
                                            ? `${t.accentBg} ring-1 ${t.accentRing}`
                                            : 'text-zinc-500 hover:text-zinc-200'
                                    }`}
                                    style={isActive ? { color: t.accent } : undefined}
                                >
                                    {t.icon}
                                    <span>{t.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div class="relative border-t border-white/5 px-8 py-7">
                    <div key={active.id} class="animate-fade-in">
                        <h3
                            class="mb-3 text-2xl font-bold tracking-tight"
                            style={{ color: active.accent }}
                        >
                            {active.headline}
                        </h3>
                        <p class="mb-7 max-w-2xl text-[15px] leading-relaxed text-zinc-300">
                            {active.description}
                        </p>

                        <div class="grid gap-2.5 sm:grid-cols-2">
                            {active.bullets.map((b) => (
                                <div
                                    key={b.label}
                                    class="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:border-white/15 hover:bg-white/[0.04]"
                                >
                                    <span
                                        class="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                                        style={{
                                            background: active.accent,
                                            boxShadow: `0 0 10px ${active.accent}`,
                                        }}
                                    />
                                    <div class="min-w-0 text-sm">
                                        <div
                                            class="mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                                            style={{ color: active.accent }}
                                        >
                                            {b.label}
                                        </div>
                                        <div class="leading-relaxed text-zinc-300">{b.body}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div class="flex items-center justify-between border-t border-white/5 bg-zinc-950 px-8 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                    <span>Esc to close</span>
                    <span>Filters & selection sync across all views</span>
                </div>
            </div>
        </div>
    );
}
