import { useMemo } from 'preact/hooks';
import type { Decision } from '../lib/types';
import { decisionColor, BRAND_NODE_COLOR } from '../lib/colors';
import type { SortMode } from './FilterBar';

interface DecisionListProps {
    decisions: Decision[];
    totalCount: number;
    sort: SortMode;
    groupByScope: boolean;
    selectedId: string | null;
    creatorMap: Map<string, string>;
    onSelect: (id: string | null) => void;
}

function formatRelative(iso: string | undefined): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Date.now() - then;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

export function DecisionList({
    decisions,
    totalCount,
    sort,
    groupByScope,
    selectedId,
    creatorMap,
    onSelect,
}: DecisionListProps) {
    const sorted = useMemo(() => {
        const list = decisions.slice();
        list.sort((a, b) => {
            if (sort === 'updated') {
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            }
            if (sort === 'created') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            // sort === 'scope'
            return a.scope.localeCompare(b.scope) || a.id.localeCompare(b.id);
        });
        return list;
    }, [decisions, sort]);

    const grouped = useMemo(() => {
        if (!groupByScope) return null;
        const groups = new Map<string, Decision[]>();
        for (const d of sorted) {
            if (!groups.has(d.scope)) groups.set(d.scope, []);
            groups.get(d.scope)!.push(d);
        }
        return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [sorted, groupByScope]);

    return (
        <div class="relative h-full w-full overflow-y-auto">
            <div class="mx-auto max-w-4xl px-6 pt-36 pb-16">
                {sorted.length === 0 ? (
                    <div class="flex flex-col items-center justify-center py-20 text-center">
                        <div class="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-600">
                            {totalCount === 0 ? 'no decisions' : 'no matches'}
                        </div>
                        <div class="text-sm text-zinc-500">
                            {totalCount === 0
                                ? 'Add one with decisionnode add'
                                : 'Try a different filter or clear it.'}
                        </div>
                    </div>
                ) : grouped ? (
                    grouped.map(([scope, items]) => {
                        // Collect unique creator colors in this group, ordered by frequency.
                        // The dot becomes a conic gradient blending all of them.
                        const counts = new Map<string, number>();
                        for (const d of items) {
                            const c = decisionColor(creatorMap.get(d.id));
                            counts.set(c, (counts.get(c) ?? 0) + 1);
                        }
                        const colors = Array.from(counts.entries())
                            .sort((a, b) => b[1] - a[1])
                            .map(([c]) => c);
                        if (colors.length === 0) colors.push(BRAND_NODE_COLOR);
                        return (
                            <div key={scope} class="mb-8">
                                <ScopeHeader scope={scope} count={items.length} colors={colors} />
                                <div class="space-y-2">
                                    {items.map((d) => (
                                        <DecisionCard
                                            key={d.id}
                                            decision={d}
                                            creator={creatorMap.get(d.id)}
                                            selected={d.id === selectedId}
                                            onClick={() => onSelect(d.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div class="space-y-2">
                        {sorted.map((d) => (
                            <DecisionCard
                                key={d.id}
                                decision={d}
                                creator={creatorMap.get(d.id)}
                                selected={d.id === selectedId}
                                onClick={() => onSelect(d.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ScopeHeader({
    scope,
    count,
    colors,
}: {
    scope: string;
    count: number;
    colors: string[];
}) {
    // Single color → solid; multiple → conic gradient blending all creators
    let background: string;
    if (colors.length === 1) {
        background = colors[0];
    } else {
        // Build evenly-spaced conic-gradient stops with a small blend per slice.
        // Repeat the first color at the end to close the loop seamlessly.
        const slice = 100 / colors.length;
        const stops = colors
            .map((c, i) => `${c} ${i * slice}% ${(i + 1) * slice}%`)
            .concat([`${colors[0]} 100%`]);
        background = `conic-gradient(from 0deg, ${stops.join(', ')})`;
    }
    // Glow color falls back to the most common (first) creator color
    const glow = colors[0];
    return (
        <div class="mb-3 flex items-center gap-2">
            <span
                class="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                    background,
                    boxShadow: `0 0 12px ${glow}80`,
                }}
            />
            <span class="font-mono text-xs uppercase tracking-wider text-zinc-300">{scope}</span>
            <span class="font-mono text-[10px] text-zinc-600">{count}</span>
            <div class="ml-3 h-px flex-1 bg-white/5" />
        </div>
    );
}

function DecisionCard({
    decision,
    creator,
    selected,
    onClick,
}: {
    decision: Decision;
    creator: string | undefined;
    selected: boolean;
    onClick: () => void;
}) {
    // Card color matches the graph: brand yellow for CLI/unknown,
    // per-MCP-client color for AI-added decisions.
    const color = decisionColor(creator);
    const isDeprecated = decision.status === 'deprecated';
    const isGlobal = decision.isGlobal;

    return (
        <button
            onClick={onClick}
            class={`group w-full rounded-lg border p-4 text-left transition-all duration-200 ${
                selected
                    ? 'border-primary-500/50 bg-primary-500/5 shadow-[0_0_24px_rgba(56,189,248,0.1)]'
                    : 'border-white/[0.06] bg-zinc-900/30 hover:border-white/15 hover:bg-zinc-900/60'
            } ${isDeprecated ? 'opacity-50' : ''}`}
            style={
                selected
                    ? { borderLeftColor: color, borderLeftWidth: '3px' }
                    : { borderLeftColor: `${color}80`, borderLeftWidth: '2px' }
            }
        >
            <div class="mb-2 flex items-center gap-2">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                    style={{
                        background: `${color}18`,
                        color: color,
                        border: `1px solid ${color}33`,
                    }}
                >
                    <span
                        class="inline-block h-1 w-1 rounded-full"
                        style={{ background: color, boxShadow: `0 0 4px ${color}` }}
                    />
                    {decision.scope}
                </span>
                <span class="font-mono text-[10px] text-zinc-600">{decision.id}</span>
                {isGlobal && (
                    <span class="rounded bg-accent-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent-400">
                        global
                    </span>
                )}
                {isDeprecated && (
                    <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                        deprecated
                    </span>
                )}
                <span class="ml-auto font-mono text-[10px] text-zinc-700">
                    {formatRelative(decision.updatedAt)}
                </span>
            </div>

            <div
                class={`mb-2 text-sm leading-snug ${
                    selected ? 'text-white' : 'text-zinc-200 group-hover:text-white'
                }`}
            >
                {decision.decision}
            </div>

            {decision.rationale && (
                <div class="mb-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                    {decision.rationale}
                </div>
            )}

            {decision.constraints && decision.constraints.length > 0 && (
                <div class="flex items-center gap-1.5 font-mono text-[10px] text-zinc-600">
                    <span>▸</span>
                    <span>
                        {decision.constraints.length} constraint
                        {decision.constraints.length > 1 ? 's' : ''}
                    </span>
                </div>
            )}
        </button>
    );
}
