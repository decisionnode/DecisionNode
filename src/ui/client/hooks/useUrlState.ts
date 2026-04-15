import { useCallback, useEffect, useState } from 'preact/hooks';

export interface UrlState {
    project: string | null;
    selected: string | null;
    threshold: number;
}

function parse(): UrlState {
    const params = new URLSearchParams(window.location.search);
    const thresholdRaw = params.get('threshold');
    const threshold = thresholdRaw ? Number.parseFloat(thresholdRaw) : 0.6;
    return {
        project: params.get('project'),
        selected: params.get('selected'),
        threshold: Number.isFinite(threshold) ? threshold : 0.6,
    };
}

function stringify(state: UrlState): string {
    const params = new URLSearchParams();
    if (state.project) params.set('project', state.project);
    if (state.selected) params.set('selected', state.selected);
    if (state.threshold !== 0.6) params.set('threshold', state.threshold.toFixed(2));
    const qs = params.toString();
    return qs ? `?${qs}` : window.location.pathname;
}

export function useUrlState(): [UrlState, (next: Partial<UrlState>) => void] {
    const [state, setState] = useState<UrlState>(() => parse());

    const update = useCallback((next: Partial<UrlState>) => {
        setState((prev) => {
            const merged = { ...prev, ...next };
            const url = stringify(merged);
            window.history.replaceState(null, '', url);
            return merged;
        });
    }, []);

    useEffect(() => {
        const onPop = () => setState(parse());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    return [state, update];
}
