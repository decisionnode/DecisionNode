import type { AppState, Decision } from './types';

async function handle<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
}

export async function fetchState(): Promise<AppState> {
    const res = await fetch('/api/state');
    return handle<AppState>(res);
}

export interface SearchResult {
    decision: Decision;
    score: number;
}

export async function search(query: string, limit = 5): Promise<SearchResult[]> {
    const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit }),
    });
    const body = await handle<{ results: SearchResult[] }>(res);
    return body.results;
}

export async function switchProject(name: string): Promise<AppState> {
    const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    return handle<AppState>(res);
}
