import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectRoot, ensureProjectFolder } from './env.js';

/**
 * A lightweight, append-only event log for read-only events like MCP searches.
 * Unlike history/activity.json, pulse entries never contain snapshots — this
 * file can grow into many entries per second without blowing up in size.
 *
 * Consumed by the web UI server (/api/events SSE stream) to animate live
 * activity without polluting the main activity log.
 */

export type PulseKind = 'searched';

export interface PulseEntry {
    kind: PulseKind;
    decisionIds: string[];
    source: string;
    query?: string;
    timestamp: string;
}

const PULSES_FILE = 'history/pulses.jsonl';
const MAX_LINES = 2000;

function getPulsePath(): string {
    return path.join(getProjectRoot(), PULSES_FILE);
}

async function ensureDir(): Promise<void> {
    await fs.mkdir(path.dirname(getPulsePath()), { recursive: true });
}

/**
 * Append a single pulse entry to the log.
 * Errors are swallowed — logging pulses should never break the caller.
 */
export async function logPulse(entry: Omit<PulseEntry, 'timestamp'>): Promise<void> {
    try {
        ensureProjectFolder();
        await ensureDir();
        const line = JSON.stringify({
            ...entry,
            timestamp: new Date().toISOString(),
        }) + '\n';
        await fs.appendFile(getPulsePath(), line, 'utf-8');

        // Occasional truncation to keep the file bounded
        if (Math.random() < 0.02) {
            await truncateIfOversized();
        }
    } catch {
        // Silently fail
    }
}

async function truncateIfOversized(): Promise<void> {
    try {
        const content = await fs.readFile(getPulsePath(), 'utf-8');
        const lines = content.split('\n').filter((l) => l.trim());
        if (lines.length > MAX_LINES) {
            const trimmed = lines.slice(-MAX_LINES).join('\n') + '\n';
            await fs.writeFile(getPulsePath(), trimmed, 'utf-8');
        }
    } catch {
        // Ignore
    }
}

/**
 * Read pulse entries since a given cutoff timestamp.
 * Used by the UI server for the 5-minute replay on SSE connect.
 */
export async function readPulsesSince(cutoffMs: number): Promise<PulseEntry[]> {
    try {
        const content = await fs.readFile(getPulsePath(), 'utf-8');
        const entries: PulseEntry[] = [];
        for (const line of content.split('\n')) {
            if (!line.trim()) continue;
            try {
                const entry = JSON.parse(line) as PulseEntry;
                if (new Date(entry.timestamp).getTime() >= cutoffMs) {
                    entries.push(entry);
                }
            } catch {
                // Skip malformed lines
            }
        }
        return entries;
    } catch {
        return [];
    }
}
