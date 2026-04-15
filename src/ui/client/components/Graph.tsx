import { useEffect, useRef } from 'preact/hooks';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
// @ts-ignore — cytoscape-fcose has no bundled types
import fcose from 'cytoscape-fcose';
import type { Decision, Edge } from '../lib/types';
import { decisionColor } from '../lib/colors';
import type { Exporter } from '../lib/export';

let registered = false;
function registerExtension() {
    if (!registered) {
        cytoscape.use(fcose);
        registered = true;
    }
}

function darkenHex(hex: string, amount: number): string {
    const v = hex.replace('#', '');
    const r = Math.max(0, Math.floor(parseInt(v.slice(0, 2), 16) * (1 - amount)));
    const g = Math.max(0, Math.floor(parseInt(v.slice(2, 4), 16) * (1 - amount)));
    const b = Math.max(0, Math.floor(parseInt(v.slice(4, 6), 16) * (1 - amount)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Subtle 3-stop gradient: white highlight → solid color across most of the orb → soft shadow rim
function gradientFor(color: string): string {
    const dark = darkenHex(color, 0.25);
    return `#ffffff ${color} ${dark}`;
}

interface PulseInput {
    decisionIds: Set<string>;
    color: string;
    id: number;
}

interface GraphProps {
    decisions: Decision[];
    edges: Edge[];
    degrees: Record<string, number>;
    selectedId: string | null;
    pulses: PulseInput[];
    matchedIds: Set<string> | null;
    creatorMap: Map<string, string>;
    dimDeprecated: boolean;
    onSelect: (id: string | null) => void;
    onExporterReady?: (exporter: Exporter | null) => void;
}

export function Graph({
    decisions,
    edges,
    degrees,
    selectedId,
    pulses,
    matchedIds,
    creatorMap,
    dimDeprecated,
    onSelect,
    onExporterReady,
}: GraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<Core | null>(null);

    // Initialize cytoscape once
    useEffect(() => {
        if (!containerRef.current) return;
        registerExtension();

        const cy = cytoscape({
            container: containerRef.current,
            style: [
                // ─── Nodes: soft-bloom orbs with always-visible dim labels ───
                {
                    selector: 'node',
                    style: {
                        'background-fill': 'radial-gradient',
                        'background-gradient-stop-colors': 'data(gradientColors)',
                        'background-gradient-stop-positions': '0 50 100',
                        'background-color': 'data(color)',
                        label: 'data(label)',
                        color: '#71717a',
                        'font-family': 'JetBrains Mono, monospace',
                        'font-size': '10px',
                        'font-weight': '500' as unknown as number,
                        'text-valign': 'bottom',
                        'text-halign': 'center',
                        'text-margin-y': 10,
                        'text-opacity': 0.55,
                        'text-outline-color': '#050505',
                        'text-outline-width': 2,
                        'text-outline-opacity': 1,
                        width: 'data(size)',
                        height: 'data(size)',
                        'border-width': 0,
                        'shadow-blur': 28,
                        'shadow-color': 'data(color)',
                        'shadow-opacity': 0.55,
                        'shadow-offset-x': 0,
                        'shadow-offset-y': 0,
                        'transition-property':
                            'opacity, text-opacity, shadow-blur, shadow-opacity, border-width, width, height, color',
                        'transition-duration': 200,
                    } as unknown as cytoscape.Css.Node,
                },
                // Hovered node — bright label, bigger glow
                {
                    selector: 'node.hover',
                    style: {
                        'text-opacity': 1,
                        color: '#f4f4f5',
                        'shadow-blur': 42,
                        'shadow-opacity': 0.9,
                        'font-weight': '700' as unknown as number,
                    } as unknown as cytoscape.Css.Node,
                },
                // Neighbor of hovered node — still visible but dimmer than hovered
                {
                    selector: 'node.neighbor',
                    style: {
                        'text-opacity': 0.9,
                        color: '#e4e4e7',
                        'shadow-blur': 34,
                        'shadow-opacity': 0.75,
                    } as unknown as cytoscape.Css.Node,
                },
                // Selected node — persistent highlight
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 2,
                        'border-color': '#38bdf8',
                        'border-opacity': 1,
                        'text-opacity': 1,
                        color: '#f8fafc',
                        'shadow-blur': 48,
                        'shadow-opacity': 1,
                    } as unknown as cytoscape.Css.Node,
                },
                // Deprecated — ghosted out
                {
                    selector: 'node.deprecated',
                    style: {
                        opacity: 0.2,
                        'shadow-opacity': 0.15,
                    } as unknown as cytoscape.Css.Node,
                },
                // Global — subtle gold ring
                {
                    selector: 'node.global',
                    style: {
                        'border-width': 1.5,
                        'border-color': '#facc15',
                        'border-opacity': 0.8,
                    } as unknown as cytoscape.Css.Node,
                },
                // Conflict — red warning ring (overrides global)
                {
                    selector: 'node.conflict',
                    style: {
                        'border-width': 2,
                        'border-color': '#f87171',
                        'border-opacity': 0.9,
                        'overlay-color': '#f87171',
                        'overlay-opacity': 0.08,
                    } as unknown as cytoscape.Css.Node,
                },
                // Faded (unrelated to hover target) — barely visible
                {
                    selector: 'node.faded',
                    style: {
                        opacity: 0.12,
                        'shadow-opacity': 0.05,
                        'text-opacity': 0.15,
                    } as unknown as cytoscape.Css.Node,
                },
                // Filtered out by the shared FilterBar — same dim treatment
                {
                    selector: 'node.unmatched',
                    style: {
                        opacity: 0.08,
                        'shadow-opacity': 0.02,
                        'text-opacity': 0.08,
                    } as unknown as cytoscape.Css.Node,
                },

                // ─── Edges: thin idle, bezier curves, glow on hover ───
                {
                    selector: 'edge',
                    style: {
                        width: 0.6,
                        'line-color': '#3f3f46',
                        'curve-style': 'unbundled-bezier',
                        'control-point-distances': 18,
                        'control-point-weights': 0.5,
                        opacity: 0.35,
                        'transition-property': 'line-color, opacity, width',
                        'transition-duration': 200,
                    } as unknown as cytoscape.Css.Edge,
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'line-color': '#38bdf8',
                        opacity: 0.95,
                        width: 1.5,
                    } as unknown as cytoscape.Css.Edge,
                },
                {
                    selector: 'edge.faded',
                    style: {
                        opacity: 0.05,
                    } as unknown as cytoscape.Css.Edge,
                },
            ],
            wheelSensitivity: 0.5,
            minZoom: 0.1,
            maxZoom: 4,
        });

        // Select on tap
        cy.on('tap', 'node', (evt) => {
            const id = evt.target.id();
            onSelect(id);
        });
        cy.on('tap', (evt) => {
            if (evt.target === cy) onSelect(null);
        });

        // Hover: fade all except hovered + neighbors
        cy.on('mouseover', 'node', (evt) => {
            const node = evt.target;
            const neighborhood = node.closedNeighborhood();
            cy.elements().addClass('faded');
            neighborhood.removeClass('faded');
            node.removeClass('faded').addClass('hover');
            neighborhood.nodes().not(node).removeClass('faded').addClass('neighbor');
            neighborhood.edges().removeClass('faded').addClass('highlighted');
        });
        cy.on('mouseout', 'node', () => {
            cy.nodes().removeClass('hover neighbor faded');
            cy.edges().removeClass('highlighted faded');
            // Re-apply selection if present
            const selected = cy.$(':selected');
            if (selected.length > 0) {
                selected.connectedEdges().addClass('highlighted');
            }
        });

        cyRef.current = cy;

        // Resize observer — handles the initial sizing race (container may be
        // 0x0 when cytoscape initializes) and any subsequent resizes.
        // Animated so it doesn't snap on top of the layout's own fit.
        let firstResize = true;
        const ro = new ResizeObserver(() => {
            cy.resize();
            // Cap zoom for the fit so sparse graphs don't blow up
            const savedMax = cy.maxZoom();
            cy.maxZoom(1.0);
            if (firstResize) {
                cy.fit(undefined, 220);
                firstResize = false;
                cy.maxZoom(savedMax);
            } else {
                cy.animate(
                    { fit: { eles: cy.elements(), padding: 220 } },
                    {
                        duration: 350,
                        easing: 'ease-out-cubic',
                        complete: () => cy.maxZoom(savedMax),
                    }
                );
            }
        });
        ro.observe(containerRef.current);

        // Register exporter
        if (onExporterReady) {
            const exporter: Exporter = {
                async toPngBlob(scale: number) {
                    // Cytoscape returns a Blob when output: 'blob'
                    const result = cy.png({
                        output: 'blob',
                        scale,
                        bg: '#050505',
                        full: true,
                    });
                    if (result instanceof Blob) return result;
                    return null;
                },
            };
            onExporterReady(exporter);
        }

        return () => {
            ro.disconnect();
            if (onExporterReady) onExporterReady(null);
            cy.destroy();
            cyRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update elements when data changes
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        const maxDegree = Math.max(1, ...Object.values(degrees));

        // Conflict detection: any edge with similarity >= 0.75
        const CONFLICT_THRESHOLD = 0.75;
        const conflictIds = new Set<string>();
        for (const e of edges) {
            if (e.similarity >= CONFLICT_THRESHOLD) {
                conflictIds.add(e.source);
                conflictIds.add(e.target);
            }
        }

        const nodes: ElementDefinition[] = decisions.map((d) => {
            const classes: string[] = [];
            // Only ghost deprecated nodes when we're showing all statuses.
            // If the user filtered down to "deprecated", they should render at
            // full opacity since they ARE the focus of the view.
            if (d.status === 'deprecated' && dimDeprecated) classes.push('deprecated');
            if (d.isGlobal) classes.push('global');
            if (conflictIds.has(d.id)) classes.push('conflict');
            // Color by creator source: brand yellow for CLI, per-client for MCP
            const color = decisionColor(creatorMap.get(d.id));
            return {
                group: 'nodes',
                data: {
                    id: d.id,
                    label: d.id,
                    color,
                    gradientColors: gradientFor(color),
                    scope: d.scope,
                    status: d.status,
                    size: 22 + ((degrees[d.id] ?? 0) / maxDegree) * 28,
                },
                classes: classes.join(' '),
            };
        });

        const edgeElements: ElementDefinition[] = edges.map((e, i) => ({
            group: 'edges',
            data: {
                id: `e${i}`,
                source: e.source,
                target: e.target,
                similarity: e.similarity,
            },
        }));

        cy.elements().remove();
        cy.add([...nodes, ...edgeElements]);

        // Temporarily cap the max zoom so sparse graphs (e.g. 2 nodes) don't
        // get blown up to fill the entire viewport during the layout's fit.
        // Restored after layoutstop so the user can still scroll-zoom in.
        const previousMaxZoom = cy.maxZoom();
        cy.maxZoom(1.0);

        const layout = cy.layout({
            name: 'fcose',
            animate: true,
            animationDuration: 700,
            animationEasing: 'ease-out-cubic',
            nodeRepulsion: 9500,
            idealEdgeLength: 160,
            nodeSeparation: 120,
            gravity: 0.25,
            gravityRangeCompound: 1.5,
            numIter: 2500,
            fit: true,
            padding: 220,
        } as cytoscape.LayoutOptions);
        layout.run();

        // Restore the user's max zoom once the layout (and its built-in fit) settle
        cy.one('layoutstop', () => {
            cy.maxZoom(previousMaxZoom);
        });
    }, [decisions, edges, degrees, creatorMap, dimDeprecated]);

    // Apply filter-bar dim (persistent, unlike hover-faded)
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;
        cy.nodes().removeClass('unmatched');
        if (matchedIds) {
            cy.nodes().forEach((n) => {
                if (!matchedIds.has(n.id())) {
                    n.addClass('unmatched');
                }
            });
        }
    }, [matchedIds]);

    // Handle selection highlight
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        cy.edges().removeClass('highlighted');
        cy.$(':selected').unselect();

        if (!selectedId) return;

        const selected = cy.getElementById(selectedId);
        if (selected.length === 0) return;
        selected.select();
        selected.connectedEdges().addClass('highlighted');
    }, [selectedId]);

    // Pulse animation
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        for (const pulse of pulses) {
            for (const decisionId of pulse.decisionIds) {
                const node = cy.getElementById(decisionId);
                if (node.length === 0) continue;

                // Burst
                node.animate(
                    {
                        style: {
                            'shadow-color': pulse.color,
                            'shadow-blur': 55,
                            'shadow-opacity': 1,
                            'border-color': pulse.color,
                            'border-width': 3,
                            'border-opacity': 1,
                        },
                    } as unknown as cytoscape.AnimateOptions,
                    { duration: 250 }
                );
                // Release
                setTimeout(() => {
                    node.animate(
                        {
                            style: {
                                'shadow-blur': 28,
                                'shadow-opacity': 0.55,
                                'border-width': 0,
                            },
                        } as unknown as cytoscape.AnimateOptions,
                        { duration: 1400 }
                    );
                }, 250);
            }
        }
    }, [pulses]);

    return (
        <div class="relative h-full w-full">
            <div ref={containerRef} class="h-full w-full" />
            {/* Subtle corner hint for interaction affordance */}
            <div class="pointer-events-none absolute bottom-3 right-4 font-mono text-[10px] text-zinc-700">
                hover · click · scroll
            </div>
        </div>
    );
}
