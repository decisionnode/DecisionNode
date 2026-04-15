import type { Decision, HistoryEntry } from '../lib/types';
import { parseClient, decisionColor } from '../lib/colors';

interface SidePanelProps {
    decision: Decision | null;
    history: HistoryEntry[];
    creator: string | undefined;
    onClose: () => void;
}

function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatRelative(iso: string | undefined): string {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diff = Date.now() - t;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    return `${mo}mo ago`;
}

function actionVerb(action: string): string {
    switch (action) {
        case 'added': return 'Added';
        case 'updated': return 'Updated';
        case 'deleted': return 'Deleted';
        case 'imported': return 'Imported';
        case 'installed': return 'Installed';
        case 'cloud_push': return 'Pushed';
        case 'cloud_pull': return 'Pulled';
        case 'conflict_resolved': return 'Resolved conflict';
        default: return action;
    }
}

export function SidePanel({ decision, history, creator, onClose }: SidePanelProps) {
    if (!decision) return null;

    const creatorColor = decisionColor(creator);
    const decisionHistory = history
        .filter((h) => h.decisionId === decision.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div class="pointer-events-auto fixed right-0 top-[53px] z-30 flex h-[calc(100vh-53px)] w-[440px] flex-col border-l border-white/5 bg-zinc-950/95 backdrop-blur-md animate-slide-up">
            {/* Glow accent strip — tinted by creator */}
            <div
                class="absolute inset-x-0 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${creatorColor}, transparent)` }}
            />
            <div
                class="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-30"
                style={{
                    background: `radial-gradient(ellipse at top, ${creatorColor}26, transparent 70%)`,
                }}
            />

            {/* Header */}
            <div class="relative flex items-start justify-between gap-3 border-b border-white/5 px-6 py-5">
                <div class="flex-1 min-w-0">
                    <div class="mb-2 flex items-center gap-2">
                        {/* Scope chip in creator color */}
                        <span
                            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
                            style={{
                                background: `${creatorColor}1a`,
                                color: creatorColor,
                                border: `1px solid ${creatorColor}40`,
                            }}
                        >
                            <span
                                class="inline-block h-1.5 w-1.5 rounded-full"
                                style={{
                                    background: creatorColor,
                                    boxShadow: `0 0 6px ${creatorColor}`,
                                }}
                            />
                            {decision.scope}
                        </span>
                        {decision.isGlobal && (
                            <span class="rounded-full border border-accent-400/40 bg-accent-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-300">
                                global
                            </span>
                        )}
                        {decision.status === 'deprecated' && (
                            <span class="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                                deprecated
                            </span>
                        )}
                    </div>
                    <div class="font-mono text-xs text-zinc-500">{decision.id}</div>
                </div>
                <button
                    onClick={onClose}
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-100"
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            {/* Body */}
            <div class="flex-1 overflow-y-auto px-6 py-5">
                {/* Decision — quote style */}
                <div class="mb-6">
                    <div class="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        Decision
                    </div>
                    <div
                        class="rounded-lg border-l-2 bg-white/[0.02] py-2.5 pl-4 pr-3 text-[15px] leading-relaxed text-zinc-100"
                        style={{ borderLeftColor: creatorColor }}
                    >
                        {decision.decision}
                    </div>
                </div>

                {/* Rationale */}
                {decision.rationale && (
                    <div class="mb-6">
                        <div class="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                            Rationale
                        </div>
                        <div class="text-sm leading-relaxed text-zinc-400">
                            {decision.rationale}
                        </div>
                    </div>
                )}

                {/* Constraints */}
                {decision.constraints && decision.constraints.length > 0 && (
                    <div class="mb-6">
                        <div class="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                            Constraints
                        </div>
                        <ul class="space-y-2">
                            {decision.constraints.map((c, i) => (
                                <li
                                    key={i}
                                    class="flex items-start gap-2.5 rounded-md bg-white/[0.02] px-3 py-2 text-sm text-zinc-300"
                                >
                                    <span
                                        class="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full"
                                        style={{ background: creatorColor }}
                                    />
                                    <span class="leading-relaxed">{c}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* History timeline — bounded scroll so a long log doesn't push
                    the decision content out of view */}
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <div class="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                            Activity
                        </div>
                        {decisionHistory.length > 0 && (
                            <span class="font-mono text-[10px] text-zinc-700">
                                {decisionHistory.length}{' '}
                                {decisionHistory.length === 1 ? 'event' : 'events'}
                            </span>
                        )}
                    </div>
                    {decisionHistory.length === 0 ? (
                        <div class="font-mono text-xs text-zinc-700">No activity yet</div>
                    ) : (
                        <div class="rounded-lg border border-white/[0.04] bg-white/[0.01]">
                            <div class="max-h-[280px] overflow-y-auto px-4 py-3 sidepanel-scroll">
                                <ul class="relative space-y-3 border-l border-white/5 pl-5">
                                    {decisionHistory.map((h) => {
                                        const { client, color } = parseClient(h.source);
                                        return (
                                            <li key={h.id} class="relative">
                                                {/* Timeline dot */}
                                                <span
                                                    class="absolute -left-[1.4rem] top-1.5 inline-block h-2 w-2 rounded-full ring-2 ring-zinc-950"
                                                    style={{
                                                        background: color,
                                                        boxShadow: `0 0 8px ${color}80`,
                                                    }}
                                                />
                                                <div class="text-sm">
                                                    <div class="text-zinc-200">
                                                        {actionVerb(h.action)}{' '}
                                                        <span class="text-zinc-600">by</span>{' '}
                                                        <span
                                                            class="font-mono font-medium"
                                                            style={{ color }}
                                                        >
                                                            {client}
                                                        </span>
                                                    </div>
                                                    <div class="mt-0.5 font-mono text-[10px] text-zinc-600">
                                                        {formatTimestamp(h.timestamp)} ·{' '}
                                                        {formatRelative(h.timestamp)}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div class="border-t border-white/5 px-6 py-3 font-mono text-[10px] text-zinc-600">
                Created {formatRelative(decision.createdAt)}
                {decision.updatedAt && decision.updatedAt !== decision.createdAt && (
                    <> · Updated {formatRelative(decision.updatedAt)}</>
                )}
            </div>
        </div>
    );
}
