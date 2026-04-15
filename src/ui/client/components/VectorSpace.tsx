import { useEffect, useRef } from 'preact/hooks';
import type { Decision, Point2D } from '../lib/types';
import { decisionColor } from '../lib/colors';
import type { Exporter } from '../lib/export';

interface PulseInput {
    decisionIds: Set<string>;
    color: string;
    id: number;
}

interface VectorSpaceProps {
    decisions: Decision[];
    points: Point2D[];
    computing: boolean;
    selectedId: string | null;
    pulses: PulseInput[];
    queryRayTargets: string[];
    matchedIds: Set<string> | null;
    creatorMap: Map<string, string>;
    dimDeprecated: boolean;
    onSelect: (id: string | null) => void;
    onExporterReady?: (exporter: Exporter | null) => void;
}

function hexToRgba(hex: string, alpha: number): string {
    const v = hex.replace('#', '');
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function VectorSpace({
    decisions,
    points,
    computing,
    selectedId,
    pulses,
    queryRayTargets,
    matchedIds,
    creatorMap,
    dimDeprecated,
    onSelect,
    onExporterReady,
}: VectorSpaceProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const stateRef = useRef<{ pan: { x: number; y: number }; zoom: number }>({
        pan: { x: 0, y: 0 },
        zoom: 1,
    });
    const draggingRef = useRef(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);

    const decisionsById = useRef<Map<string, Decision>>(new Map());
    decisionsById.current = new Map(decisions.map((d) => [d.id, d]));

    const draw = () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Grid
        ctx.strokeStyle = '#1a1a1e';
        ctx.lineWidth = 1;
        const gridSize = 64;
        ctx.beginPath();
        for (let x = 0; x < rect.width; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, rect.height);
        }
        for (let y = 0; y < rect.height; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(rect.width, y);
        }
        ctx.stroke();

        const cx = rect.width / 2 + stateRef.current.pan.x;
        const cy = rect.height / 2 + stateRef.current.pan.y;
        const zoom = stateRef.current.zoom;
        const scale = 0.4 * zoom;

        // Axes — soft crosshair through origin
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(cx - 400, cy);
        ctx.lineTo(cx + 400, cy);
        ctx.moveTo(cx, cy - 400);
        ctx.lineTo(cx, cy + 400);
        ctx.stroke();
        ctx.setLineDash([]);

        // Origin marker
        ctx.fillStyle = '#3f3f46';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#52525b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Draw vectors (lines from origin + arrowheads + tip circles)
        // Pass 1: lines, fainter first
        for (const p of points) {
            const decision = decisionsById.current.get(p.id);
            if (!decision) continue;
            const tx = cx + p.x * scale;
            const ty = cy + p.y * scale;
            const isSelected = decision.id === selectedId;
            const isDeprecated = decision.status === 'deprecated' && dimDeprecated;
            const isUnmatched = matchedIds !== null && !matchedIds.has(p.id);
            const color = decisionColor(creatorMap.get(decision.id));

            const baseAlpha = isDeprecated ? 0.2 : isSelected ? 1 : 0.75;
            ctx.globalAlpha = isUnmatched ? baseAlpha * 0.08 : baseAlpha;

            // Gradient line from origin (dim) to tip (vivid)
            const grad = ctx.createLinearGradient(cx, cy, tx, ty);
            grad.addColorStop(0, hexToRgba(color, 0));
            grad.addColorStop(0.2, hexToRgba(color, 0.1));
            grad.addColorStop(1, hexToRgba(color, isSelected ? 1 : 0.7));
            ctx.strokeStyle = grad;
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(tx, ty);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Pass 1.5: query rays — animated lines from origin to query match tips
        if (queryRayTargets.length > 0) {
            const rayPhase = (Date.now() % 2500) / 2500;
            const rayAlpha = Math.max(0, 1 - rayPhase);
            for (const targetId of queryRayTargets) {
                const p = points.find((pt) => pt.id === targetId);
                if (!p) continue;
                const tx = cx + p.x * scale;
                const ty = cy + p.y * scale;
                // Dashed animated cyan line
                ctx.save();
                ctx.strokeStyle = `rgba(56, 189, 248, ${rayAlpha * 0.9})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 6]);
                ctx.lineDashOffset = -rayPhase * 40;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(tx, ty);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Compute which decisions are currently being pulsed (for halo override)
        const pulseById = new Map<string, string>(); // id -> pulse color
        for (const pulse of pulses) {
            for (const id of pulse.decisionIds) {
                pulseById.set(id, pulse.color);
            }
        }

        // Pass 2: tip markers (3D-looking radial-gradient orbs)
        for (const p of points) {
            const decision = decisionsById.current.get(p.id);
            if (!decision) continue;
            const tx = cx + p.x * scale;
            const ty = cy + p.y * scale;
            const isSelected = decision.id === selectedId;
            const isDeprecated = decision.status === 'deprecated' && dimDeprecated;
            const isUnmatched = matchedIds !== null && !matchedIds.has(decision.id);
            const color = decisionColor(creatorMap.get(decision.id));
            const pulseColor = pulseById.get(decision.id);
            const radius = isSelected ? 9 : 6;

            const baseTipAlpha = isDeprecated ? 0.35 : 1;
            ctx.globalAlpha = isUnmatched ? baseTipAlpha * 0.1 : baseTipAlpha;

            // Pulse halo — brighter than the selection halo
            if (pulseColor) {
                const halo = ctx.createRadialGradient(tx, ty, 0, tx, ty, radius * 6);
                halo.addColorStop(0, hexToRgba(pulseColor, 0.85));
                halo.addColorStop(0.4, hexToRgba(pulseColor, 0.4));
                halo.addColorStop(1, hexToRgba(pulseColor, 0));
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(tx, ty, radius * 6, 0, Math.PI * 2);
                ctx.fill();
            }

            // Outer glow halo (only for selected)
            if (isSelected) {
                const halo = ctx.createRadialGradient(tx, ty, 0, tx, ty, radius * 4);
                halo.addColorStop(0, hexToRgba(color, 0.45));
                halo.addColorStop(1, hexToRgba(color, 0));
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(tx, ty, radius * 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Orb body — radial gradient with offset highlight
            const orb = ctx.createRadialGradient(
                tx - radius * 0.35,
                ty - radius * 0.35,
                radius * 0.1,
                tx,
                ty,
                radius
            );
            orb.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
            orb.addColorStop(0.25, color);
            orb.addColorStop(1, hexToRgba(color, 0.3));
            ctx.fillStyle = orb;
            ctx.beginPath();
            ctx.arc(tx, ty, radius, 0, Math.PI * 2);
            ctx.fill();

            // Dark outline for definition
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 0.75;
            ctx.stroke();

            // Selected ring
            if (isSelected) {
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(tx, ty, radius + 3, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    };

    // Keep a ref to the latest draw so the rAF loop always uses the freshest
    // props (matchedIds, pulses, dimDeprecated, etc.) instead of the stale
    // closure from when the loop was first set up.
    const drawRef = useRef(draw);
    drawRef.current = draw;

    useEffect(() => {
        let frame = 0;
        const loop = () => {
            drawRef.current();
            frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        const onResize = () => draw();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Register exporter — captures the current canvas pixel buffer (already
    // rendered at devicePixelRatio so 2x on Retina is automatic)
    useEffect(() => {
        if (!onExporterReady) return;
        const exporter: Exporter = {
            async toPngBlob(_scale: number) {
                const canvas = canvasRef.current;
                if (!canvas) return null;
                // Force a re-draw to capture latest state
                draw();
                return new Promise<Blob | null>((resolve) => {
                    canvas.toBlob((blob) => resolve(blob), 'image/png');
                });
            },
        };
        onExporterReady(exporter);
        return () => onExporterReady(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onExporterReady]);

    const handleMouseDown = (e: MouseEvent) => {
        draggingRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseMove = (e: MouseEvent) => {
        if (!draggingRef.current || !lastPosRef.current) return;
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        stateRef.current.pan.x += dx;
        stateRef.current.pan.y += dy;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseUp = () => {
        draggingRef.current = false;
        lastPosRef.current = null;
    };
    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        // Continuous zoom proportional to wheel delta — feels natural on both
        // mouse wheels (deltaY ≈ ±100 per tick) and trackpads (smaller, more frequent)
        const factor = Math.pow(1.002, -e.deltaY);
        stateRef.current.zoom = Math.max(0.2, Math.min(6, stateRef.current.zoom * factor));
    };
    const handleClick = (e: MouseEvent) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2 + stateRef.current.pan.x;
        const cy = rect.height / 2 + stateRef.current.pan.y;
        const zoom = stateRef.current.zoom;
        const scale = 0.4 * zoom;

        let closest: { id: string; dist: number } | null = null;
        for (const p of points) {
            const px = cx + p.x * scale;
            const py = cy + p.y * scale;
            const dist = Math.hypot(px - x, py - y);
            if (dist < 14 && (!closest || dist < closest.dist)) {
                closest = { id: p.id, dist };
            }
        }
        onSelect(closest ? closest.id : null);
    };

    return (
        <div
            ref={containerRef}
            class="relative h-full w-full overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onClick={handleClick}
        >
            <canvas ref={canvasRef} class="block cursor-grab active:cursor-grabbing" />
            {computing && (
                <div class="pointer-events-none absolute bottom-3 right-3 rounded bg-zinc-900/80 px-2 py-1 font-mono text-[10px] text-zinc-400">
                    Computing UMAP…
                </div>
            )}
            {points.length === 0 && !computing && (
                <div class="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-xs text-zinc-600">
                    No embeddings to project
                </div>
            )}
        </div>
    );
}
