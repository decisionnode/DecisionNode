import { describe, it, expect, afterAll } from 'vitest';
import { startUiServer, UiServerHandle } from '../../src/ui/server.js';

describe('UI server smoke tests', () => {
    let handle: UiServerHandle | null = null;

    afterAll(async () => {
        if (handle) await handle.close();
    });

    it('starts on a random free port and serves HTML', async () => {
        handle = await startUiServer({ port: 0 });
        expect(handle.url).toMatch(/^http:\/\/localhost:\d+$/);

        const res = await fetch(handle.url + '/');
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain('<div id="app">');
        expect(text).toContain('DecisionNode');
    });

    it('serves /api/state as JSON', async () => {
        if (!handle) throw new Error('server not started');
        const res = await fetch(handle.url + '/api/state');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('decisions');
        expect(body).toHaveProperty('projects');
        expect(body).toHaveProperty('scopes');
        expect(body).toHaveProperty('config');
        expect(Array.isArray(body.decisions)).toBe(true);
        expect(Array.isArray(body.projects)).toBe(true);
    });

    it('returns 404 for unknown routes', async () => {
        if (!handle) throw new Error('server not started');
        const res = await fetch(handle.url + '/does-not-exist.txt');
        expect(res.status).toBe(404);
    });

    it('rejects /api/search without query', async () => {
        if (!handle) throw new Error('server not started');
        const res = await fetch(handle.url + '/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });
});
