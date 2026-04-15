import { useEffect, useState, useCallback } from 'preact/hooks';
import type { AppState } from '../lib/types';
import { fetchState, switchProject } from '../lib/api';

interface UseDecisionsResult {
    state: AppState | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    switchTo: (projectName: string) => Promise<void>;
}

export function useDecisions(): UseDecisionsResult {
    const [state, setState] = useState<AppState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const next = await fetchState();
            setState(next);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    const switchTo = useCallback(async (name: string) => {
        setLoading(true);
        setError(null);
        try {
            const next = await switchProject(name);
            setState(next);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    return { state, loading, error, refetch, switchTo };
}
