import { useEffect, useState } from 'preact/hooks';
import { UMAP } from 'umap-js';
import type { Decision, Point2D } from '../lib/types';

interface UseUmapResult {
    points: Point2D[];
    computing: boolean;
}

/**
 * Project decisions' embedding vectors to 2D via UMAP.
 * Only re-runs when decision set changes.
 * For <1000 decisions, this runs in <2s on modern machines.
 */
export function useUmap(decisions: Decision[]): UseUmapResult {
    const [points, setPoints] = useState<Point2D[]>([]);
    const [computing, setComputing] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const withVectors = decisions.filter((d) => d.vector && d.vector.length > 0);

        if (withVectors.length === 0) {
            setPoints([]);
            return;
        }

        // Need at least nNeighbors + 1 points to run UMAP
        if (withVectors.length < 4) {
            // Trivial layout — line them up
            const fallback: Point2D[] = withVectors.map((d, i) => ({
                id: d.id,
                x: (i - (withVectors.length - 1) / 2) * 120,
                y: 0,
            }));
            setPoints(fallback);
            return;
        }

        setComputing(true);
        // Run async to not block render
        const run = async () => {
            const vectors = withVectors.map((d) => d.vector!);
            const nNeighbors = Math.min(15, Math.max(2, withVectors.length - 1));
            const umap = new UMAP({
                nComponents: 2,
                nNeighbors,
                minDist: 0.1,
                spread: 1.0,
            });
            const embedding = await umap.fitAsync(vectors);
            if (cancelled) return;

            // Scale and center the embedding to a ~600x600 viewport
            const xs = embedding.map((p) => p[0]);
            const ys = embedding.map((p) => p[1]);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const rangeX = Math.max(maxX - minX, 0.001);
            const rangeY = Math.max(maxY - minY, 0.001);
            const scale = 600 / Math.max(rangeX, rangeY);

            const scaled: Point2D[] = withVectors.map((d, i) => ({
                id: d.id,
                x: (embedding[i][0] - (minX + maxX) / 2) * scale,
                y: (embedding[i][1] - (minY + maxY) / 2) * scale,
            }));
            setPoints(scaled);
            setComputing(false);
        };

        void run().catch(() => {
            if (!cancelled) setComputing(false);
        });

        return () => {
            cancelled = true;
        };
    }, [decisions]);

    return { points, computing };
}
