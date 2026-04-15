import { useMemo } from 'preact/hooks';
import type { AppState } from '../lib/types';

interface TopBarProps {
    state: AppState;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    onSearchSubmit: (q: string) => void;
    onOpenProjectPicker: () => void;
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

export function TopBar({
    state,
    searchQuery,
    onSearchChange,
    onSearchSubmit,
    onOpenProjectPicker,
}: TopBarProps) {
    const activeCount = state.decisions.filter((d) => d.status === 'active').length;
    const deprecatedCount = state.decisions.filter((d) => d.status === 'deprecated').length;

    const lastUpdated = useMemo(() => {
        const times = state.decisions
            .map((d) => d.updatedAt)
            .filter(Boolean)
            .sort()
            .reverse();
        return formatRelative(times[0]);
    }, [state.decisions]);

    return (
        <div class="relative z-20 flex items-center gap-4 border-b border-white/5 bg-zinc-950/80 px-6 py-3 backdrop-blur-md">
            {/* Logo — matches website Navbar */}
            <div class="group relative flex items-center gap-2 select-none">
                <div class="relative">
                    <div class="absolute inset-0 rounded-full bg-primary-500/20 opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-100" />
                    <img
                        src="/logo.png"
                        alt="DecisionNode"
                        class="relative z-10 h-8 w-auto object-contain brightness-110"
                        draggable={false}
                    />
                </div>
                <span class="text-lg font-bold tracking-tight">
                    <span class="text-primary-400">Decision</span>
                    <span class="text-accent-500">Node</span>
                </span>
            </div>

            {/* Project picker button */}
            <button
                onClick={onOpenProjectPicker}
                class="group ml-2 flex items-center gap-2 rounded-md border border-white/10 bg-zinc-900/60 px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none transition hover:border-white/20 hover:bg-zinc-900/80"
            >
                <span class="text-[10px] uppercase tracking-wider text-zinc-600">project</span>
                <span class="text-primary-300">{state.currentProject ?? '—'}</span>
                <span class="text-zinc-600 transition group-hover:text-zinc-400">⌄</span>
            </button>

            {/* Search */}
            <form
                class="max-w-xl flex-1"
                autoComplete="off"
                onSubmit={(e) => {
                    e.preventDefault();
                    onSearchSubmit(searchQuery);
                }}
            >
                <div class="relative">
                    <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
                        ⌕
                    </span>
                    <input
                        id="decisionnode-search"
                        type="text"
                        value={searchQuery}
                        onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
                        placeholder="Search decisions semantically…"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellcheck={false}
                        class="w-full rounded-md border border-white/10 bg-zinc-900/60 py-1.5 pl-9 pr-3 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none transition hover:border-white/20 focus:border-primary-400"
                    />
                    <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[10px] text-zinc-700">
                        /
                    </span>
                </div>
            </form>

            {/* Stats */}
            <div class="flex items-center gap-4 font-mono text-xs text-zinc-500">
                <span>
                    <span class="text-primary-300">{activeCount}</span> decisions
                </span>
                <span class="text-zinc-700">·</span>
                <span>
                    <span class="text-primary-300">{state.scopes.length}</span> scopes
                </span>
                {deprecatedCount > 0 && (
                    <>
                        <span class="text-zinc-700">·</span>
                        <span>
                            <span class="text-zinc-400">{deprecatedCount}</span> deprecated
                        </span>
                    </>
                )}
                {lastUpdated && (
                    <>
                        <span class="text-zinc-700">·</span>
                        <span>{lastUpdated}</span>
                    </>
                )}
            </div>
        </div>
    );
}
