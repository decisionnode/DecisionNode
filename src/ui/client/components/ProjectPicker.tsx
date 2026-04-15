import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ProjectInfo } from '../lib/types';

interface ProjectPickerProps {
    open: boolean;
    projects: ProjectInfo[];
    currentProject: string | null;
    onSelect: (name: string) => void;
    onClose: () => void;
}

type SortMode = 'name' | 'count' | 'modified';

const PAGE_SIZE = 10;

function formatRelative(iso: string | undefined): string {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
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

export function ProjectPicker({
    open,
    projects,
    currentProject,
    onSelect,
    onClose,
}: ProjectPickerProps) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortMode>('modified');
    const [page, setPage] = useState(0);

    // Reset state when opened
    useEffect(() => {
        if (open) {
            setQuery('');
            setSort('modified');
            setPage(0);
        }
    }, [open]);

    // Keyboard: Escape closes, arrow keys navigate, enter selects
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const filteredSorted = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q
            ? projects.filter((p) => p.name.toLowerCase().includes(q))
            : projects.slice();

        filtered.sort((a, b) => {
            if (sort === 'name') return a.name.localeCompare(b.name);
            if (sort === 'count') return b.decisionCount - a.decisionCount;
            // modified
            const ta = a.lastModified ? new Date(a.lastModified).getTime() : 0;
            const tb = b.lastModified ? new Date(b.lastModified).getTime() : 0;
            return tb - ta;
        });
        return filtered;
    }, [projects, query, sort]);

    const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const visible = filteredSorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    if (!open) return null;

    return (
        <div
            class="fixed inset-0 z-40 flex items-start justify-center bg-black/60 pt-24 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                class="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/70 animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div class="flex items-center justify-between border-b border-white/5 px-5 py-4">
                    <div>
                        <div class="text-sm font-semibold text-zinc-100">Switch Project</div>
                        <div class="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                            {projects.length} projects
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        class="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Search */}
                <div class="border-b border-white/5 px-5 py-3">
                    <div class="relative">
                        <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
                            ⌕
                        </span>
                        <input
                            autoFocus
                            type="text"
                            value={query}
                            onInput={(e) => {
                                setQuery((e.target as HTMLInputElement).value);
                                setPage(0);
                            }}
                            placeholder="Search projects…"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellcheck={false}
                            class="w-full rounded-md border border-white/10 bg-zinc-900/60 py-2 pl-9 pr-3 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none transition focus:border-primary-400"
                        />
                    </div>

                    {/* Filters / sort */}
                    <div class="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
                        <span class="text-zinc-600">sort by</span>
                        {(['modified', 'name', 'count'] as SortMode[]).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setSort(mode)}
                                class={`rounded px-2 py-0.5 transition ${
                                    sort === mode
                                        ? 'bg-primary-500/15 text-primary-300'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div class="max-h-[50vh] overflow-y-auto">
                    {visible.length === 0 ? (
                        <div class="px-5 py-10 text-center font-mono text-xs text-zinc-600">
                            No projects match "{query}"
                        </div>
                    ) : (
                        <ul>
                            {visible.map((project) => {
                                const isCurrent = project.name === currentProject;
                                return (
                                    <li key={project.name}>
                                        <button
                                            onClick={() => {
                                                onSelect(project.name);
                                                onClose();
                                            }}
                                            class={`group flex w-full items-center justify-between gap-4 border-b border-white/[0.03] px-5 py-3 text-left transition ${
                                                isCurrent
                                                    ? 'bg-primary-500/5'
                                                    : 'hover:bg-white/[0.03]'
                                            }`}
                                        >
                                            <div class="min-w-0 flex-1">
                                                <div class="flex items-center gap-2">
                                                    <span
                                                        class={`truncate text-sm font-semibold ${
                                                            isCurrent
                                                                ? 'text-primary-300'
                                                                : 'text-zinc-200 group-hover:text-white'
                                                        }`}
                                                    >
                                                        {project.name}
                                                    </span>
                                                    {isCurrent && (
                                                        <span class="font-mono text-[10px] uppercase tracking-wider text-primary-400">
                                                            current
                                                        </span>
                                                    )}
                                                </div>
                                                <div class="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-[10px] text-zinc-600">
                                                    {project.scopes.slice(0, 4).map((s) => (
                                                        <span
                                                            key={s}
                                                            class="rounded bg-zinc-800/60 px-1.5 py-0.5 text-zinc-400"
                                                        >
                                                            {s}
                                                        </span>
                                                    ))}
                                                    {project.scopes.length > 4 && (
                                                        <span class="text-zinc-600">
                                                            +{project.scopes.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div class="text-right font-mono text-[10px] text-zinc-500">
                                                <div>
                                                    <span class="text-primary-300">
                                                        {project.decisionCount}
                                                    </span>{' '}
                                                    decisions
                                                </div>
                                                <div class="text-zinc-600">
                                                    {formatRelative(project.lastModified)}
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Footer: pagination */}
                {totalPages > 1 && (
                    <div class="flex items-center justify-between border-t border-white/5 px-5 py-3 font-mono text-[10px] text-zinc-600">
                        <span>
                            {safePage * PAGE_SIZE + 1}–
                            {Math.min((safePage + 1) * PAGE_SIZE, filteredSorted.length)} of{' '}
                            {filteredSorted.length}
                        </span>
                        <div class="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={safePage === 0}
                                class="rounded px-2 py-0.5 transition hover:bg-white/5 disabled:opacity-30"
                            >
                                ← prev
                            </button>
                            <span class="text-zinc-500">
                                {safePage + 1}/{totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={safePage === totalPages - 1}
                                class="rounded px-2 py-0.5 transition hover:bg-white/5 disabled:opacity-30"
                            >
                                next →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
