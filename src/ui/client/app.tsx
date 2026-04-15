import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';

import { useDecisions } from './hooks/useDecisions';
import { useEdges } from './hooks/useEdges';
import { useUmap } from './hooks/useUmap';
import { useUrlState } from './hooks/useUrlState';
import { useLiveEvents, type ServerEvent } from './hooks/useLiveEvents';

import { TopBar } from './components/TopBar';
import { Graph } from './components/Graph';
import { VectorSpace } from './components/VectorSpace';
import { DecisionList } from './components/DecisionList';
import { SidePanel } from './components/SidePanel';
import { ProjectPicker } from './components/ProjectPicker';
import { ViewToggle, type ViewMode } from './components/ViewToggle';
import { FilterBar, type StatusFilter, type SortMode } from './components/FilterBar';
import { Tour } from './components/Tour';
import { SearchResults } from './components/SearchResults';
import { ExportMenu } from './components/ExportMenu';
import { InfoModal } from './components/InfoModal';

import { parseClient } from './lib/colors';
import { search as searchApi, type SearchResult } from './lib/api';
import {
    type Exporter,
    type ExportFormat,
    downloadBlob,
    copyBlobToClipboard,
    todayFilename,
} from './lib/export';

export interface PulseState {
    decisionIds: Set<string>;
    color: string;
    client: string;
    id: number;
}

function App() {
    const { state, loading, error, switchTo, refetch } = useDecisions();
    const [url, updateUrl] = useUrlState();
    const [exporter, setExporter] = useState<Exporter | null>(null);
    const [exportToast, setExportToast] = useState<string | null>(null);
    const [infoOpen, setInfoOpen] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [projectPickerOpen, setProjectPickerOpen] = useState(false);
    const [activePulses, setActivePulses] = useState<PulseState[]>([]);
    const [queryRayTargets, setQueryRayTargets] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('graph');

    // Shared filter state (applies to all three views)
    const [textFilter, setTextFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [groupByScope, setGroupByScope] = useState(true);
    // Fixed sort — UI removed; list always sorts by most recently updated
    const sort: SortMode = 'updated';

    // Semantic search results state
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [submittedQuery, setSubmittedQuery] = useState('');

    // Handle live events
    useLiveEvents({
        onEvent: (event: ServerEvent) => {
            if (event.type === 'pulse') {
                const { client, color } = parseClient(event.source);
                const pulseId = Date.now() + Math.random();
                setActivePulses((prev) => [
                    ...prev,
                    { decisionIds: new Set(event.decisionIds), color, client, id: pulseId },
                ]);
                // Remove after 1.8s (pulse animation duration)
                setTimeout(() => {
                    setActivePulses((prev) => prev.filter((p) => p.id !== pulseId));
                }, 1800);
            } else if (event.type === 'activity') {
                // A decision was added/updated/deleted — refetch state
                void refetch();
                // Also trigger a brief pulse on the affected decision
                const { client, color } = parseClient(event.source);
                const pulseId = Date.now() + Math.random();
                setActivePulses((prev) => [
                    ...prev,
                    {
                        decisionIds: new Set([event.decisionId]),
                        color,
                        client,
                        id: pulseId,
                    },
                ]);
                setTimeout(() => {
                    setActivePulses((prev) => prev.filter((p) => p.id !== pulseId));
                }, 1800);
            } else if (event.type === 'data_changed') {
                void refetch();
            }
        },
    });

    const allDecisions = useMemo(() => {
        if (!state) return [];
        return [
            ...state.decisions.map((d) => ({ ...d, isGlobal: false })),
            ...state.globals.map((d) => ({ ...d, isGlobal: true })),
        ];
    }, [state]);

    // Map decision id → creator source ('cli' | 'mcp:claude-code' | …)
    // Built from history's 'added' entries. Used to color nodes by attribution.
    const creatorMap = useMemo(() => {
        const map = new Map<string, string>();
        if (!state) return map;
        for (const entry of state.history) {
            if (entry.action === 'added' && !map.has(entry.decisionId)) {
                map.set(entry.decisionId, entry.source ?? 'cli');
            }
        }
        return map;
    }, [state]);

    // Apply shared filters → produces the visible subset
    const filteredDecisions = useMemo(() => {
        const q = textFilter.trim().toLowerCase();
        return allDecisions.filter((d) => {
            if (statusFilter !== 'all' && d.status !== statusFilter) return false;
            if (!q) return true;
            return (
                d.id.toLowerCase().includes(q) ||
                d.scope.toLowerCase().includes(q) ||
                d.decision.toLowerCase().includes(q) ||
                (d.rationale ?? '').toLowerCase().includes(q) ||
                (d.constraints ?? []).some((c) => c.toLowerCase().includes(q))
            );
        });
    }, [allDecisions, textFilter, statusFilter]);

    const matchedIds = useMemo(
        () => new Set(filteredDecisions.map((d) => d.id)),
        [filteredDecisions]
    );

    const filtersActive = textFilter.trim() !== '' || statusFilter !== 'all';
    // Ghost deprecated nodes only when we're showing everything. If the user
    // has narrowed to "deprecated" or "active", that filter handles visibility
    // and we want the matching nodes to render at full opacity.
    const dimDeprecated = statusFilter === 'all';

    const { edges, degrees } = useEdges(allDecisions, url.threshold);
    const { points, computing } = useUmap(allDecisions);

    const selectedDecision = useMemo(() => {
        if (!url.selected || !state) return null;
        return allDecisions.find((d) => d.id === url.selected) ?? null;
    }, [url.selected, allDecisions, state]);

    const handleSelect = (id: string | null) => {
        updateUrl({ selected: id });
    };

    const handleProjectChange = async (name: string) => {
        await switchTo(name);
        updateUrl({ project: name, selected: null });
    };

    const handleThresholdChange = (value: number) => {
        updateUrl({ threshold: value });
    };

    const handleExport = async (format: ExportFormat) => {
        if (!exporter) {
            setExportToast('Switch to graph or vector space to export');
            setTimeout(() => setExportToast(null), 2200);
            return;
        }
        try {
            const blob = await exporter.toPngBlob(3);
            if (!blob) {
                setExportToast('Export failed');
                setTimeout(() => setExportToast(null), 2200);
                return;
            }
            if (format === 'download') {
                const prefix = `decisionnode-${viewMode}`;
                downloadBlob(blob, todayFilename(prefix, 'png'));
                setExportToast('Saved');
            } else {
                const ok = await copyBlobToClipboard(blob);
                setExportToast(ok ? 'Copied to clipboard' : 'Clipboard not supported');
            }
            setTimeout(() => setExportToast(null), 2000);
        } catch (e) {
            setExportToast(e instanceof Error ? e.message : 'Export failed');
            setTimeout(() => setExportToast(null), 2200);
        }
    };

    const handleSearchSubmit = async (q: string) => {
        const trimmed = q.trim();
        if (!trimmed) {
            setSearchOpen(false);
            setSearchResults([]);
            setQueryRayTargets([]);
            return;
        }
        setSubmittedQuery(trimmed);
        setSearchOpen(true);
        setSearchLoading(true);
        setSearchError(null);
        try {
            const results = await searchApi(trimmed, 10);
            setSearchResults(results);
            const ids = results.map((r) => r.decision.id);
            setQueryRayTargets(ids);
            // Fade the vector-space rays after 4s
            setTimeout(() => setQueryRayTargets([]), 4000);
        } catch (e) {
            setSearchError(e instanceof Error ? e.message : 'Search failed');
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSearchResultClick = (id: string) => {
        setSearchOpen(false);
        handleSelect(id);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
                e.preventDefault();
                document.getElementById('decisionnode-search')?.focus();
            } else if (e.key === 'Escape') {
                if (url.selected) handleSelect(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url.selected]);

    if (error) {
        return (
            <div class="flex h-full min-h-screen items-center justify-center bg-background">
                <div class="text-center">
                    <div class="mb-2 font-mono text-sm text-red-400">Failed to load state</div>
                    <div class="font-mono text-xs text-zinc-600">{error}</div>
                </div>
            </div>
        );
    }

    if (loading || !state) {
        return (
            <div class="flex h-full min-h-screen items-center justify-center bg-background bg-grid-pattern">
                <div class="relative">
                    <div class="absolute inset-0 -z-10 animate-glow-pulse rounded-full bg-primary-500/15 blur-[80px]" />
                    <div class="text-3xl font-bold tracking-tight">
                        <span class="text-primary-400">Decision</span>
                        <span class="text-accent-400">Node</span>
                    </div>
                    <div class="mt-2 text-center font-mono text-xs text-zinc-600">Loading…</div>
                </div>
            </div>
        );
    }

    const hasDecisions = allDecisions.length > 0;

    return (
        <div class="flex h-screen flex-col bg-background">
            <TopBar
                state={state}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSearchSubmit={handleSearchSubmit}
                onOpenProjectPicker={() => setProjectPickerOpen(true)}
            />

            <ExportMenu onExport={handleExport} onOpenInfo={() => setInfoOpen(true)} />

            <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />

            <ProjectPicker
                open={projectPickerOpen}
                projects={state.projects}
                currentProject={state.currentProject}
                onSelect={handleProjectChange}
                onClose={() => setProjectPickerOpen(false)}
            />

            <SearchResults
                open={searchOpen}
                query={submittedQuery}
                loading={searchLoading}
                results={searchResults}
                error={searchError}
                creatorMap={creatorMap}
                onSelect={handleSearchResultClick}
                onClose={() => setSearchOpen(false)}
            />

            {/* Main canvas region */}
            <div class="relative flex flex-1 overflow-hidden">
                {/* Ambient glows */}
                <div class="pointer-events-none absolute inset-0">
                    <div class="absolute top-1/4 left-1/4 h-96 w-96 animate-glow-pulse rounded-full bg-primary-500/10 blur-[120px]" />
                    <div
                        class="absolute bottom-1/4 right-1/4 h-96 w-96 animate-glow-pulse rounded-full bg-accent-500/5 blur-[140px]"
                        style={{ animationDelay: '1.2s' }}
                    />
                </div>

                {!hasDecisions ? (
                    <div class="flex flex-1 items-center justify-center">
                        <div class="text-center">
                            <div class="mb-3 font-mono text-xs uppercase tracking-wider text-zinc-600">
                                no decisions in this project
                            </div>
                            <div class="text-zinc-400">
                                Add one with{' '}
                                <code class="rounded bg-zinc-900 px-2 py-1 font-mono text-xs text-primary-300">
                                    decisionnode add
                                </code>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div class="relative flex-1">
                        {/* View toggle — floating pill at top of canvas */}
                        <ViewToggle
                            view={viewMode}
                            onChange={setViewMode}
                            graphStat={`${edges.length} edges`}
                            vectorStat={computing ? 'computing…' : `${points.length} pts`}
                            listStat={`${allDecisions.length} items`}
                        />

                        {/* Shared filter bar — applies to all three views */}
                        <FilterBar
                            viewMode={viewMode}
                            textFilter={textFilter}
                            onTextFilterChange={setTextFilter}
                            statusFilter={statusFilter}
                            onStatusFilterChange={setStatusFilter}
                            visibleCount={filteredDecisions.length}
                            totalCount={allDecisions.length}
                            groupByScope={groupByScope}
                            onGroupByScopeChange={setGroupByScope}
                        />

                        {/* Full-width canvas */}
                        <div class="absolute inset-0">
                            {viewMode === 'graph' && (
                                <Graph
                                    decisions={allDecisions}
                                    edges={edges}
                                    degrees={degrees}
                                    selectedId={url.selected}
                                    pulses={activePulses}
                                    matchedIds={filtersActive ? matchedIds : null}
                                    creatorMap={creatorMap}
                                    dimDeprecated={dimDeprecated}
                                    onSelect={handleSelect}
                                    onExporterReady={setExporter}
                                />
                            )}
                            {viewMode === 'vector' && (
                                <VectorSpace
                                    decisions={allDecisions}
                                    points={points}
                                    computing={computing}
                                    selectedId={url.selected}
                                    pulses={activePulses}
                                    queryRayTargets={queryRayTargets}
                                    matchedIds={filtersActive ? matchedIds : null}
                                    creatorMap={creatorMap}
                                    dimDeprecated={dimDeprecated}
                                    onSelect={handleSelect}
                                    onExporterReady={setExporter}
                                />
                            )}
                            {viewMode === 'list' && (
                                <DecisionList
                                    decisions={filteredDecisions}
                                    totalCount={allDecisions.length}
                                    sort={sort}
                                    groupByScope={groupByScope}
                                    selectedId={url.selected}
                                    creatorMap={creatorMap}
                                    onSelect={handleSelect}
                                />
                            )}
                        </div>

                        {/* Bottom control bar — threshold slider — graph view only */}
                        {viewMode === 'graph' && (
                            <div class="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
                                <div class="pointer-events-auto flex items-center gap-4 rounded-full border border-white/10 bg-zinc-950/80 px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500 shadow-2xl shadow-black/50 backdrop-blur-md">
                                    <span>threshold</span>
                                    <input
                                        type="range"
                                        min="0.3"
                                        max="0.95"
                                        step="0.01"
                                        value={url.threshold}
                                        onInput={(e) =>
                                            handleThresholdChange(
                                                Number.parseFloat((e.target as HTMLInputElement).value)
                                            )
                                        }
                                        class="w-40 accent-primary-400"
                                    />
                                    <span class="w-8 text-primary-300">{url.threshold.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <SidePanel
                decision={selectedDecision}
                history={state.history}
                creator={selectedDecision ? creatorMap.get(selectedDecision.id) : undefined}
                onClose={() => handleSelect(null)}
            />

            {exportToast && (
                <div class="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
                    <div class="rounded-full border border-primary-500/30 bg-zinc-950/90 px-4 py-2 font-mono text-xs text-primary-300 shadow-2xl shadow-black/70 backdrop-blur-md">
                        {exportToast}
                    </div>
                </div>
            )}

            <Tour />
        </div>
    );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
