import type { Decision, Edge } from './types';

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute pairwise similarity edges between decisions.
 * Only returns edges with similarity >= threshold.
 * O(n²/2) — fine for n < 2000.
 */
export function computeEdges(
    decisions: Decision[],
    threshold: number
): Edge[] {
    const edges: Edge[] = [];
    const withVectors = decisions.filter((d) => d.vector && d.vector.length > 0);
    for (let i = 0; i < withVectors.length; i++) {
        for (let j = i + 1; j < withVectors.length; j++) {
            const a = withVectors[i];
            const b = withVectors[j];
            const sim = cosineSimilarity(a.vector!, b.vector!);
            if (sim >= threshold) {
                edges.push({ source: a.id, target: b.id, similarity: sim });
            }
        }
    }
    return edges;
}

/**
 * Count degree per decision id given a set of edges.
 */
export function computeDegrees(
    decisions: Decision[],
    edges: Edge[]
): Record<string, number> {
    const degrees: Record<string, number> = {};
    for (const d of decisions) degrees[d.id] = 0;
    for (const e of edges) {
        degrees[e.source] = (degrees[e.source] ?? 0) + 1;
        degrees[e.target] = (degrees[e.target] ?? 0) + 1;
    }
    return degrees;
}

/**
 * k-nearest neighbors for a given decision by similarity.
 */
export function kNearest(
    target: Decision,
    decisions: Decision[],
    k: number
): { id: string; similarity: number }[] {
    if (!target.vector) return [];
    const scores: { id: string; similarity: number }[] = [];
    for (const d of decisions) {
        if (d.id === target.id || !d.vector) continue;
        scores.push({ id: d.id, similarity: cosineSimilarity(target.vector, d.vector) });
    }
    scores.sort((a, b) => b.similarity - a.similarity);
    return scores.slice(0, k);
}
