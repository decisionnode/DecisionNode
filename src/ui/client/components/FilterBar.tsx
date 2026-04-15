import type { ViewMode } from './ViewToggle';

export type StatusFilter = 'all' | 'active' | 'deprecated';
export type SortMode = 'updated' | 'created' | 'scope';

interface FilterBarProps {
    viewMode: ViewMode;

    textFilter: string;
    onTextFilterChange: (v: string) => void;

    statusFilter: StatusFilter;
    onStatusFilterChange: (v: StatusFilter) => void;

    visibleCount: number;
    totalCount: number;

    // List-only controls
    groupByScope: boolean;
    onGroupByScopeChange: (v: boolean) => void;
}

export function FilterBar({
    viewMode,
    textFilter,
    onTextFilterChange,
    statusFilter,
    onStatusFilterChange,
    visibleCount,
    totalCount,
    groupByScope,
    onGroupByScopeChange,
}: FilterBarProps) {
    const active = textFilter.trim() !== '' || statusFilter !== 'all';

    return (
        <div class="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2">
            <div
                class={`pointer-events-auto flex items-center gap-3 rounded-full border bg-zinc-950/80 px-3 py-1.5 shadow-2xl shadow-black/50 backdrop-blur-md transition-all duration-300 ${
                    active
                        ? 'border-primary-500/30 shadow-[0_0_30px_rgba(56,189,248,0.12)]'
                        : 'border-white/10'
                }`}
            >
                {/* Text filter input */}
                <div class="relative flex items-center">
                    <span class="pointer-events-none absolute left-3 text-zinc-500">⌕</span>
                    <input
                        type="text"
                        value={textFilter}
                        onInput={(e) => onTextFilterChange((e.target as HTMLInputElement).value)}
                        placeholder="Filter by text…"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellcheck={false}
                        class="w-56 rounded-full border border-white/10 bg-zinc-900/60 py-1 pl-8 pr-3 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-primary-400 focus:bg-zinc-900/90"
                    />
                    {textFilter && (
                        <button
                            onClick={() => onTextFilterChange('')}
                            class="absolute right-2 flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
                            aria-label="Clear filter"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Status pills */}
                <div class="flex items-center gap-0.5 rounded-full bg-zinc-900/60 p-0.5 font-mono text-[10px] uppercase tracking-wider">
                    {(['all', 'active', 'deprecated'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => onStatusFilterChange(mode)}
                            class={`rounded-full px-2.5 py-0.5 transition ${
                                statusFilter === mode
                                    ? 'bg-primary-500/15 text-primary-300 ring-1 ring-primary-500/30'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                {/* List-only: group by scope */}
                {viewMode === 'list' && (
                    <>
                        <div class="h-4 w-px bg-white/5" />
                        <button
                            onClick={() => onGroupByScopeChange(!groupByScope)}
                            class={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition ${
                                groupByScope
                                    ? 'border-violet-500/30 bg-violet-500/15 text-violet-300'
                                    : 'border-white/10 text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            group by scope
                        </button>
                    </>
                )}

                {/* Count */}
                <span class="font-mono text-[10px] text-zinc-600">
                    {active ? `${visibleCount}/${totalCount}` : `${totalCount}`}
                </span>
            </div>
        </div>
    );
}
