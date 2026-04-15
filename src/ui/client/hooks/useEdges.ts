import { useMemo } from 'preact/hooks';
import type { Decision, Edge } from '../lib/types';
import { computeEdges, computeDegrees } from '../lib/similarity';

interface UseEdgesResult {
    edges: Edge[];
    degrees: Record<string, number>;
}

/**
 * Compute edges + degrees, memoized on the decision set and threshold.
 * Runs pairwise similarity only when inputs actually change.
 */
export function useEdges(decisions: Decision[], threshold: number): UseEdgesResult {
    return useMemo(() => {
        const edges = computeEdges(decisions, threshold);
        const degrees = computeDegrees(decisions, edges);
        return { edges, degrees };
    }, [decisions, threshold]);
}
