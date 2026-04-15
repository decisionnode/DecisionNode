/**
 * Centralized color palette for the DecisionNode UI.
 *
 * To rebrand or remap an MCP client's attribution color, edit the maps below
 * — every component pulls from these constants.
 */

// Default node color — the yellow "Node" word from the DecisionNode logo.
// Used for any decision created via the CLI or with an unknown source.
export const BRAND_NODE_COLOR = '#facc15';

// Per-MCP-client attribution colors.
// Keys are the lowercased MCP client identifiers reported by the SDK.
// Add or rename entries here to remap colors across the entire UI.
export const CLIENT_COLORS: Record<string, string> = {
    'claude-code': '#38bdf8',     // electric cyan (Claude brand)
    'claude-desktop': '#7dd3fc',  // light cyan
    cursor: '#fb923c',             // orange
    windsurf: '#4ade80',           // emerald
    antigravity: '#a78bfa',        // violet
    cline: '#fde047',              // bright yellow
    cli: BRAND_NODE_COLOR,         // brand yellow — terminal user
    cloud: '#f472b6',              // pink
};

const FALLBACK_CLIENT_COLOR = '#94a3b8'; // slate-400

/**
 * Returns the canonical color a decision should be rendered with, based on
 * the source string from history. Used by Graph + VectorSpace.
 *
 * Examples:
 *   undefined         → BRAND_NODE_COLOR (yellow)
 *   'cli'             → BRAND_NODE_COLOR
 *   'mcp:claude-code' → CLIENT_COLORS['claude-code']
 *   'mcp:cursor'      → CLIENT_COLORS['cursor']
 */
export function decisionColor(source: string | undefined): string {
    if (!source || source === 'cli' || source === 'mcp') return BRAND_NODE_COLOR;
    if (source.startsWith('mcp:')) {
        const client = source.slice(4);
        return CLIENT_COLORS[client] ?? CLIENT_COLORS['claude-code'] ?? FALLBACK_CLIENT_COLOR;
    }
    return CLIENT_COLORS[source] ?? BRAND_NODE_COLOR;
}

/**
 * Legacy helper used by the List view's scope chips and the side panel.
 * Returns a stable color per scope name from the brand palette.
 */
const CURATED_SCOPE_COLORS = [
    '#38bdf8', '#facc15', '#0ea5e9', '#fde047',
    '#7dd3fc', '#eab308', '#0284c7', '#ca8a04',
];

function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h << 5) - h + s.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

export function scopeColor(scope: string): string {
    const idx = hashString(scope.toLowerCase()) % CURATED_SCOPE_COLORS.length;
    return CURATED_SCOPE_COLORS[idx];
}

/**
 * Parse a history entry's `source` field for the SidePanel timeline.
 * Returns the client name + its attribution color.
 */
export function parseClient(source: string | undefined): { client: string; color: string } {
    if (!source) return { client: 'unknown', color: FALLBACK_CLIENT_COLOR };
    if (source.startsWith('mcp:')) {
        const client = source.slice(4);
        return { client, color: CLIENT_COLORS[client] ?? FALLBACK_CLIENT_COLOR };
    }
    return { client: source, color: CLIENT_COLORS[source] ?? FALLBACK_CLIENT_COLOR };
}
