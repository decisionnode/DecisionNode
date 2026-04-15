import { useEffect, useRef } from 'preact/hooks';
import type { SearchResult } from '../lib/api';
import { decisionColor } from '../lib/colors';

interface SearchResultsProps {
    open: boolean;
    query: string;
    loading: boolean;
    results: SearchResult[];
    error: string | null;
    creatorMap: Map<string, string>;
    onSelect: (id: string) => void;
    onClose: () => void;
}

function scoreColor(score: number): string {
    if (score >= 0.75) return '#34d399'; // emerald — strong
    if (score >= 0.6) return '#fde047';  // yellow — good
    if (score >= 0.45) return '#fb923c'; // orange — weak
    return '#71717a';                     // zinc — very weak
}

export function SearchResults({
    open,
    query,
    loading,
    results,
    error,
    creatorMap,
    onSelect,
    onClose,
}: SearchResultsProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            ref={containerRef}
            class="absolute left-1/2 top-[60px] z-40 w-[640px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/70 backdrop-blur-md animate-fade-in"
        >
            {/* Header */}
            <div class="flex items-center gap-3 border-b border-white/5 px-5 py-3">
                <span class="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    semantic search
                </span>
                <span class="font-mono text-xs text-primary-300">"{query}"</span>
                {loading && (
                    <span class="ml-auto font-mono text-[10px] text-zinc-600">searching…</span>
                )}
                {!loading && !error && (
                    <span class="ml-auto font-mono text-[10px] text-zinc-600">
                        {results.length} {results.length === 1 ? 'match' : 'matches'}
                    </span>
                )}
            </div>

            {/* Body */}
            <div class="max-h-[60vh] overflow-y-auto">
                {error && (
                    <div class="px-5 py-6 text-center">
                        <div class="mb-1 font-mono text-[10px] uppercase tracking-wider text-red-400">
                            error
                        </div>
                        <div class="font-mono text-xs text-zinc-500">{error}</div>
                        <div class="mt-2 text-xs text-zinc-600">
                            Semantic search needs the Gemini API key. Run{' '}
                            <code class="rounded bg-zinc-900 px-1.5 py-0.5 text-primary-300">
                                decisionnode setup
                            </code>
                            .
                        </div>
                    </div>
                )}

                {!error && !loading && results.length === 0 && (
                    <div class="px-5 py-8 text-center font-mono text-xs text-zinc-600">
                        no matches above the threshold
                    </div>
                )}

                {!error && results.length > 0 && (
                    <ul>
                        {results.map((r, i) => {
                            const color = decisionColor(creatorMap.get(r.decision.id));
                            const sc = Math.round(r.score * 100);
                            const scClr = scoreColor(r.score);
                            return (
                                <li key={r.decision.id}>
                                    <button
                                        onClick={() => onSelect(r.decision.id)}
                                        class="group flex w-full items-start gap-3 border-b border-white/[0.04] px-5 py-3 text-left transition hover:bg-white/[0.03]"
                                    >
                                        {/* Rank pill */}
                                        <span class="mt-0.5 w-5 shrink-0 font-mono text-[10px] text-zinc-700">
                                            #{i + 1}
                                        </span>

                                        {/* Score badge */}
                                        <span
                                            class="mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums"
                                            style={{
                                                background: `${scClr}18`,
                                                color: scClr,
                                            }}
                                        >
                                            {sc}%
                                        </span>

                                        {/* Body */}
                                        <div class="flex-1 min-w-0">
                                            <div class="mb-1 flex items-center gap-2">
                                                <span
                                                    class="inline-block h-2 w-2 rounded-full"
                                                    style={{
                                                        background: color,
                                                        boxShadow: `0 0 8px ${color}80`,
                                                    }}
                                                />
                                                <span class="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                                                    {r.decision.scope}
                                                </span>
                                                <span class="font-mono text-[10px] text-zinc-700">
                                                    {r.decision.id}
                                                </span>
                                                {r.decision.status === 'deprecated' && (
                                                    <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                                                        deprecated
                                                    </span>
                                                )}
                                            </div>
                                            <div class="line-clamp-2 text-sm text-zinc-200 group-hover:text-white">
                                                {r.decision.decision}
                                            </div>
                                            {r.decision.rationale && (
                                                <div class="mt-1 line-clamp-1 text-xs text-zinc-500">
                                                    {r.decision.rationale}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Footer */}
            <div class="flex items-center justify-between border-t border-white/5 bg-zinc-950 px-5 py-2 font-mono text-[10px] text-zinc-600">
                <span>click to open · Esc to close</span>
                <span>ranked by cosine similarity</span>
            </div>
        </div>
    );
}
