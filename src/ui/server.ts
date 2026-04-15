import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listDecisions, listGlobalDecisions, listProjects } from '../store.js';
import { loadVectorCache, loadGlobalVectorCache, findRelevantDecisions } from '../ai/rag.js';
import { getCurrentProject, setCurrentProject, getSearchThreshold, getAgentBehavior, getProjectRoot } from '../env.js';
import { getHistory } from '../history.js';
import { readPulsesSince, type PulseEntry } from '../pulse.js';
import type { DecisionNode } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = __dirname; // dist/ui is sibling to dist/ui/server.js
const DEFAULT_PORT = 7788;

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

export interface UiServerOptions {
    port?: number;
}

export interface UiServerHandle {
    url: string;
    close: () => Promise<void>;
}

async function readState() {
    const currentProject = getCurrentProject();
    const [decisions, globals, projects, vectors, globalVectors, history] = await Promise.all([
        listDecisions(),
        listGlobalDecisions(),
        listProjects(),
        loadVectorCache(),
        loadGlobalVectorCache(),
        getHistory(100),
    ]);

    const scopes = Array.from(new Set(decisions.map((d) => d.scope))).sort();
    const globalScopes = Array.from(new Set(globals.map((d) => d.scope))).sort();

    const getVec = (entry: unknown): number[] | null => {
        if (!entry) return null;
        if (Array.isArray(entry)) return entry as number[];
        if (typeof entry === 'object' && 'vector' in (entry as Record<string, unknown>)) {
            const v = (entry as { vector: unknown }).vector;
            return Array.isArray(v) ? (v as number[]) : null;
        }
        return null;
    };

    const attach = (d: DecisionNode, cache: Record<string, unknown>) => ({
        ...d,
        vector: getVec(cache[d.id]),
    });

    return {
        currentProject,
        projects,
        decisions: decisions.map((d) => attach(d, vectors)),
        globals: globals.map((d) => attach(d, globalVectors)),
        scopes,
        globalScopes,
        history,
        config: {
            searchThreshold: getSearchThreshold(),
            agentBehavior: getAgentBehavior(),
        },
    };
}

async function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}

async function serveStatic(res: http.ServerResponse, urlPath: string) {
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(STATIC_DIR, rel);

    // Prevent path traversal
    if (!filePath.startsWith(STATIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    try {
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] ?? 'application/octet-stream',
            'Cache-Control': 'no-cache',
        });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
}

// ─── SSE event broadcasting ────────────────────────────────
type SseClient = {
    res: http.ServerResponse;
    id: number;
};

const sseClients = new Set<SseClient>();
let sseClientIdSeq = 0;

type ServerEvent =
    | { type: 'pulse'; decisionIds: string[]; source: string; client: string | null; query?: string; timestamp: string }
    | { type: 'activity'; action: string; decisionId: string; source: string; client: string | null; timestamp: string }
    | { type: 'data_changed'; timestamp: string };

function broadcast(event: ServerEvent) {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
        try {
            client.res.write(line);
        } catch {
            // Will be cleaned up on 'close'
        }
    }
}

function parseSource(source: string | undefined): { source: string; client: string | null } {
    if (!source) return { source: 'unknown', client: null };
    if (source.startsWith('mcp:')) {
        return { source, client: source.slice(4) };
    }
    return { source, client: null };
}

function setupSseHeaders(res: http.ServerResponse) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    // Initial comment to open the stream
    res.write(': connected\n\n');
}

async function handleSse(req: http.IncomingMessage, res: http.ServerResponse) {
    setupSseHeaders(res);

    const id = ++sseClientIdSeq;
    const client: SseClient = { res, id };
    sseClients.add(client);

    // Heartbeat to prevent intermediaries from closing the connection
    const heartbeat = setInterval(() => {
        try {
            res.write(': ping\n\n');
        } catch {
            // Will be cleaned up on 'close'
        }
    }, 25_000);

    const cleanup = () => {
        clearInterval(heartbeat);
        sseClients.delete(client);
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    // Replay: last 5 minutes of activity + pulse events
    try {
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        const [history, pulses] = await Promise.all([
            getHistory(50),
            readPulsesSince(fiveMinAgo),
        ]);

        const replayEvents: ServerEvent[] = [];

        for (const entry of history) {
            const ts = new Date(entry.timestamp).getTime();
            if (!Number.isNaN(ts) && ts >= fiveMinAgo) {
                const { source, client: clientName } = parseSource(entry.source);
                replayEvents.push({
                    type: 'activity',
                    action: entry.action,
                    decisionId: entry.decisionId,
                    source,
                    client: clientName,
                    timestamp: entry.timestamp,
                });
            }
        }

        for (const pulse of pulses) {
            const { source, client: clientName } = parseSource(pulse.source);
            replayEvents.push({
                type: 'pulse',
                decisionIds: pulse.decisionIds,
                source,
                client: clientName,
                query: pulse.query,
                timestamp: pulse.timestamp,
            });
        }

        // Sort by timestamp (oldest first) so the replay animates chronologically
        replayEvents.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        for (const evt of replayEvents) {
            res.write(`data: ${JSON.stringify(evt)}\n\n`);
        }
    } catch {
        // Replay is best-effort
    }
}

// ─── File watching ─────────────────────────────────────────
interface WatchHandle {
    close: () => void;
}

let currentWatch: WatchHandle | null = null;

function setupFileWatchers(): WatchHandle {
    const projectRoot = getProjectRoot();
    const historyDir = path.join(projectRoot, 'history');
    const activityPath = path.join(historyDir, 'activity.json');
    const pulsesPath = path.join(historyDir, 'pulses.jsonl');

    // Ensure the history directory exists so we can watch it even before
    // the first mutation/pulse happens
    try {
        fsSync.mkdirSync(historyDir, { recursive: true });
    } catch {
        // Ignore
    }

    let lastActivityMtime = 0;
    let lastPulseOffset = 0;
    try {
        lastActivityMtime = fsSync.statSync(activityPath).mtimeMs;
    } catch {
        // File doesn't exist yet
    }
    try {
        lastPulseOffset = fsSync.statSync(pulsesPath).size;
    } catch {
        // File doesn't exist yet
    }

    const handleActivityChange = async () => {
        try {
            const stat = await fs.stat(activityPath);
            if (stat.mtimeMs <= lastActivityMtime) return;
            lastActivityMtime = stat.mtimeMs;

            const content = await fs.readFile(activityPath, 'utf-8');
            const log = JSON.parse(content) as { entries: Array<{ id: string; action: string; decisionId: string; source?: string; timestamp: string }> };
            // Emit the most recent entry only (last mutation)
            const latest = log.entries[0];
            if (latest) {
                const { source, client } = parseSource(latest.source);
                broadcast({
                    type: 'activity',
                    action: latest.action,
                    decisionId: latest.decisionId,
                    source,
                    client,
                    timestamp: latest.timestamp,
                });
                broadcast({ type: 'data_changed', timestamp: new Date().toISOString() });
            }
        } catch {
            // Ignore
        }
    };

    const handlePulseChange = async () => {
        try {
            const stat = await fs.stat(pulsesPath);
            if (stat.size === lastPulseOffset) return;

            // Read only the new bytes appended since last check
            const stream = fsSync.createReadStream(pulsesPath, {
                start: lastPulseOffset,
                end: stat.size,
            });
            lastPulseOffset = stat.size;

            let buffer = '';
            for await (const chunk of stream) {
                buffer += chunk.toString('utf-8');
            }
            for (const line of buffer.split('\n')) {
                if (!line.trim()) continue;
                try {
                    const entry = JSON.parse(line) as PulseEntry;
                    const { source, client } = parseSource(entry.source);
                    broadcast({
                        type: 'pulse',
                        decisionIds: entry.decisionIds,
                        source,
                        client,
                        query: entry.query,
                        timestamp: entry.timestamp,
                    });
                } catch {
                    // Skip malformed lines
                }
            }
        } catch {
            // Ignore
        }
    };

    // fs.watch on the directory handles file creation/rename/modification
    let historyWatcher: fsSync.FSWatcher | null = null;
    try {
        historyWatcher = fsSync.watch(historyDir, (_eventType, filename) => {
            if (filename === 'activity.json') {
                void handleActivityChange();
            } else if (filename === 'pulses.jsonl') {
                void handlePulseChange();
            }
        });
    } catch {
        // If fs.watch isn't supported (rare), the UI just won't have live updates
    }

    return {
        close: () => {
            historyWatcher?.close();
        },
    };
}

function refreshFileWatchers() {
    currentWatch?.close();
    currentWatch = setupFileWatchers();
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = url.pathname;

    try {
        if (pathname === '/api/events' && req.method === 'GET') {
            await handleSse(req, res);
            return;
        }

        if (pathname === '/api/state' && req.method === 'GET') {
            const state = await readState();
            sendJson(res, 200, state);
            return;
        }

        if (pathname === '/api/search' && req.method === 'POST') {
            const body = await readBody(req);
            const { query, limit } = JSON.parse(body || '{}') as { query?: string; limit?: number };
            if (!query || typeof query !== 'string') {
                sendJson(res, 400, { error: 'query is required' });
                return;
            }
            const results = await findRelevantDecisions(query, limit ?? 5);
            sendJson(res, 200, { results });
            return;
        }

        if (pathname === '/api/project' && req.method === 'POST') {
            const body = await readBody(req);
            const { name } = JSON.parse(body || '{}') as { name?: string };
            if (!name || typeof name !== 'string') {
                sendJson(res, 400, { error: 'name is required' });
                return;
            }
            setCurrentProject(name);
            // Re-setup watchers for the new project
            refreshFileWatchers();
            const state = await readState();
            sendJson(res, 200, state);
            return;
        }

        if (req.method === 'GET') {
            await serveStatic(res, pathname);
            return;
        }

        res.writeHead(405);
        res.end('Method not allowed');
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, 500, { error: message });
    }
}

async function listenOnPort(
    server: http.Server,
    port: number
): Promise<{ port: number }> {
    return new Promise((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException) => {
            server.off('listening', onListening);
            reject(err);
        };
        const onListening = () => {
            server.off('error', onError);
            const address = server.address();
            const actualPort = typeof address === 'object' && address ? address.port : port;
            resolve({ port: actualPort });
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, '127.0.0.1');
    });
}

export async function startUiServer(options: UiServerOptions = {}): Promise<UiServerHandle> {
    const server = http.createServer((req, res) => {
        void handleRequest(req, res);
    });

    const requestedPort = options.port ?? DEFAULT_PORT;
    let actualPort: number;
    try {
        const result = await listenOnPort(server, requestedPort);
        actualPort = result.port;
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EADDRINUSE' && options.port === undefined) {
            // Fall back to a random free port
            const result = await listenOnPort(server, 0);
            actualPort = result.port;
        } else {
            throw err;
        }
    }

    const url = `http://localhost:${actualPort}`;

    // Start watching the current project's files
    refreshFileWatchers();

    return {
        url,
        close: () =>
            new Promise<void>((resolve, reject) => {
                currentWatch?.close();
                currentWatch = null;
                // Close all SSE connections
                for (const client of sseClients) {
                    try {
                        client.res.end();
                    } catch {
                        // Ignore
                    }
                }
                sseClients.clear();
                server.close((err) => (err ? reject(err) : resolve()));
            }),
    };
}
