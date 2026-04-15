#!/usr/bin/env node
// MUST interact with environment before other imports - this import does side-effects (loading .env)
import { getAgentBehavior } from '../env.js';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { findRelevantDecisions, findPotentialConflicts } from '../ai/rag.js';
import { isEmbeddingAvailable } from '../ai/gemini.js';
import { getHistory, getSnapshot, getDecisionsFromSnapshot } from '../history.js';
import { logPulse } from '../pulse.js';
import { addDecision, updateDecision, deleteDecision, listDecisions, getDecisionById, getNextDecisionId, importDecisions, listProjects, listGlobalDecisions, addGlobalDecision, getNextGlobalDecisionId, getGlobalDecisionById, updateGlobalDecision, deleteGlobalDecision } from '../store.js';
import { DecisionNode } from '../types.js';
import { getProjectRoot, getCurrentProject, setCurrentProject, GLOBAL_STORE, isGlobalId, stripGlobalPrefix } from '../env.js';

// Create MCP server
const server = new Server(
    {
        name: 'decisionnode',
        version: '0.5.1',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

/**
 * Helper to ensure project is set before operations
 * Validates that project name is a simple folder basename (no slashes, colons, etc.)
 */
function ensureProject(args: unknown): void {
    if (args && typeof args === 'object' && 'project' in args && (args as Record<string, unknown>).project) {
        const projectName = (args as Record<string, unknown>).project as string;

        // Validate: reject project names that look like paths or corpus names
        // Valid: "my-project", "decisionnode-marketplace"
        // Invalid: "user/repo", "C:\\path\\to\\folder", "/absolute/path"
        if (projectName.includes('/') || projectName.includes('\\') || projectName.includes(':')) {
            throw new Error(
                `Invalid project name "${projectName}". ` +
                `Project name must be a simple folder basename (no slashes, colons, or path separators). ` +
                `Example: "my-project" not "user/repo" or "C:\\path\\to\\folder".`
            );
        }

        // Also reject if it looks too long (likely a full path)
        if (projectName.length > 100) {
            throw new Error(
                `Invalid project name "${projectName.substring(0, 50)}...". ` +
                `Project name is too long. Use the folder basename only.`
            );
        }

        setCurrentProject(projectName);
    }
}

/**
 * Get the MCP source string for history logging, e.g. "mcp:claude-code"
 */
function getMcpSource(): `mcp:${string}` | 'mcp' {
    try {
        const client = server.getClientVersion();
        if (client?.name) {
            return `mcp:${client.name}`;
        }
    } catch {
        // Client info not available yet
    }
    return 'mcp';
}

// Tool descriptions based on agent behavior setting
const SEARCH_DESCRIPTIONS = {
    strict: `**MANDATORY: Call this FIRST before ANY code changes.** When user asks you to: add a feature, modify code, fix a bug, implement something, refactor, style UI, or make ANY technical choice — you MUST call this tool FIRST to check for existing conventions. Skipping this causes inconsistency and wasted rework. Query with what you're about to work on: "button styling", "error handling", "API design", "authentication", "database schema", "component structure". If no decisions exist, proceed freely; if decisions exist, FOLLOW them.`,

    relaxed: `Check for existing decisions when making significant changes or when unsure about project conventions. Use this tool to understand established patterns before implementing major features, architectural changes, or when working on new areas of the codebase. Query with what you're working on: "styling", "API design", "database". If no decisions exist, proceed with your best judgment.`
};

// Define available tools with enhanced descriptions for AI auto-discovery
server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Get current agent behavior setting
    const behavior = getAgentBehavior();
    const searchDescription = SEARCH_DESCRIPTIONS[behavior];

    return {
        tools: [
            {
                name: 'search_decisions',
                description: searchDescription,
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Natural language query describing what you are about to work on (e.g., "button styling", "API error handling", "database connection")',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of results (default: 3)',
                        },
                        project: {
                            type: 'string',
                            description: 'REQUIRED: The project folder name. Extract this from the user\'s active file path (e.g., if path is ".../decisionnode-marketplace/src/...", use "decisionnode-marketplace"). Call list_projects first if unsure.',
                        },
                    },
                    required: ['query', 'project'],
                },
            },
            {
                name: 'list_decisions',
                description: 'List all recorded decisions for the project. Use this when you need a complete overview of project conventions, or when starting work on a new feature area to understand existing patterns.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        scope: {
                            type: 'string',
                            description: 'Filter by scope (e.g., UI, Backend, API, Architecture)',
                        },
                        project: {
                            type: 'string',
                            description: 'The workspace folder name',
                        },
                    },
                    required: ['project'],
                },
            },
            {
                name: 'get_decision',
                description: 'Get full details of a specific decision by ID. Use this after search_decisions returns relevant results to get complete context including rationale and constraints.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Decision ID (e.g., ui-001)',
                        },
                        project: {
                            type: 'string',
                            description: 'The workspace folder name',
                        },
                    },
                    required: ['id', 'project'],
                },
            },
            {
                name: 'add_decision',
                description: `**Call this IMMEDIATELY** when user says phrases like: "Let's use...", "From now on...", "Always do...", "Never do...", "I prefer...", "The standard is...", "We should always...", or confirms ANY technical approach. Also call when: (1) A design pattern is established, (2) An architectural choice is made, (3) Coding standards are discussed, (4) UI/UX conventions are agreed, (5) Technology stack decisions happen. Capture decisions DURING the conversation, not after. Focus on WHY, not just WHAT.`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        scope: {
                            type: 'string',
                            description: 'Category: UI, Backend, API, Architecture, Database, Security, Testing, DevOps, Styling, Performance',
                        },
                        decision: {
                            type: 'string',
                            description: 'Clear statement of what was decided (be specific and actionable)',
                        },
                        rationale: {
                            type: 'string',
                            description: 'Why this decision was made - this is crucial for future context',
                        },

                        constraints: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Specific rules or requirements to follow',
                        },
                        global: {
                            type: 'boolean',
                            description: 'Set to true to create a global decision that applies across ALL projects (e.g., "always use TypeScript strict mode", "never commit .env files")',
                        },
                        force: {
                            type: 'boolean',
                            description: 'Set to true to skip conflict detection and add the decision even if similar ones exist. Use after reviewing the conflicts returned by a previous add_decision call.',
                        },
                        project: {
                            type: 'string',
                            description: 'The workspace folder name',
                        },
                    },
                    required: ['scope', 'decision', 'rationale', 'constraints', 'project'],
                },
            },
            {
                name: 'update_decision',
                description: 'Update an existing decision when requirements change or the approach evolves. Use this instead of creating duplicate decisions.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Decision ID to update',
                        },
                        decision: {
                            type: 'string',
                            description: 'Updated decision text',
                        },
                        rationale: {
                            type: 'string',
                            description: 'Updated rationale',
                        },
                        status: {
                            type: 'string',
                            enum: ['active', 'deprecated'],
                            description: 'Set to "deprecated" to hide from search (keeps for history), or "active" to re-enable. Only change when the user explicitly asks.',
                        },
                        constraints: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Updated list of constraints',
                        },
                        project: {
                            type: 'string',
                            description: 'The workspace folder name',
                        },
                    },
                    required: ['id', 'decision', 'rationale', 'constraints', 'project'],
                },
            },
            {
                name: 'delete_decision',
                description: 'Permanently delete a decision. Only use when a decision was created in error. For outdated decisions, prefer update_decision with status=deprecated to preserve history.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Decision ID to delete',
                        },
                        project: {
                            type: 'string',
                            description: 'The workspace folder name',
                        },
                    },
                    required: ['id', 'project'],
                },
            },
            {
                name: 'get_history',
                description: 'View the activity log of recent decision changes. Use this to understand what decisions were recently added or modified.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Number of entries (default: 10)',
                        },
                        project: {
                            type: 'string',
                            description: 'The workspace folder name',
                        },
                    },
                    required: ['limit', 'project'],
                },
            },
            {
                name: 'get_status',
                description: 'Get project decision status overview including total count and last activity. Use this for a quick health check of the decision store.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        project: {
                            type: 'string',
                            description: 'The workspace folder name',
                        },
                    },
                    required: ['project'],
                },
            },
            {
                name: 'list_projects',
                description: `**Call this FIRST if unsure which project to use.** In monorepos or multi-project workspaces, this lists all projects with decisions. Match the returned project name to the subfolder in the user's active file path. Example: if user is editing ".../my-app/src/component.tsx", look for project "my-app" in the results.`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        verbose: {
                            type: 'boolean',
                            description: 'Include detailed statistics (default: false)',
                        },
                    },
                },
            },
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
        case 'search_decisions': {
            ensureProject(args);
            const { query, limit = 3 } = args as { query: string; limit?: number };

            const embeddingReady = await isEmbeddingAvailable();
            if (!embeddingReady) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: 'No Gemini API key configured. Ask the user to run: decide setup',
                        }),
                    }],
                };
            }

            const results = await findRelevantDecisions(query, limit);

            // Log as a pulse event so the web UI can animate the matches
            if (results.length > 0) {
                void logPulse({
                    kind: 'searched',
                    decisionIds: results.map((r) => r.decision.id),
                    source: getMcpSource(),
                    query,
                });
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            results.map((r) => ({
                                id: r.decision.id,
                                scope: r.decision.scope,
                                decision: r.decision.decision,
                                rationale: r.decision.rationale,
                                score: Math.round(r.score * 100) + '%',
                            })),
                            null,
                            2
                        ),
                    },
                ],
            };
        }

        case 'list_decisions': {
            ensureProject(args);
            const { scope } = args as { scope?: string };
            const projectDecisions = await listDecisions(scope);
            const globalDecisions = await listGlobalDecisions();

            const allDecisions = [...projectDecisions, ...globalDecisions];

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            allDecisions.map((d) => ({
                                id: d.id,
                                scope: d.scope,
                                decision: d.decision,
                                status: d.status,
                            })),
                            null,
                            2
                        ),
                    },
                ],
            };
        }

        case 'get_decision': {
            ensureProject(args);
            const { id } = args as { id: string };
            const decision = isGlobalId(id)
                ? await getGlobalDecisionById(id)
                : await getDecisionById(id);

            if (!decision) {
                return {
                    content: [{ type: 'text', text: JSON.stringify({ error: `Decision ${id} not found` }) }],
                };
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(decision, null, 2) }],
            };
        }

        case 'add_decision': {
            ensureProject(args);
            const { scope, decision, rationale, constraints, global: isGlobal, force } = args as {
                scope: string;
                decision: string;
                rationale?: string;
                constraints?: string[];
                global?: boolean;
                force?: boolean;
            };

            const canEmbed = await isEmbeddingAvailable();
            if (!canEmbed) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: 'No Gemini API key configured. The decision cannot be embedded for search. Ask the user to run: decide setup',
                        }),
                    }],
                };
            }

            // Check for similar decisions unless force=true
            if (!force) {
                try {
                    const conflicts = await findPotentialConflicts(`${scope}: ${decision}`, 0.75);
                    if (conflicts.length > 0) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(
                                        {
                                            success: false,
                                            reason: 'similar_decisions_found',
                                            message: 'Similar decisions already exist. You can: (1) update an existing decision with update_decision, (2) deprecate the old one with update_decision(status="deprecated") then re-call add_decision with force=true, or (3) re-call add_decision with force=true to add anyway.',
                                            similar: conflicts.map(c => ({
                                                id: c.decision.id,
                                                scope: c.decision.scope,
                                                decision: c.decision.decision,
                                                similarity: Math.round(c.score * 100) + '%',
                                            })),
                                        },
                                        null,
                                        2
                                    ),
                                },
                            ],
                        };
                    }
                } catch {
                    // API key not set or embedding failed — skip conflict check
                }
            }

            if (isGlobal) {
                const rawId = await getNextGlobalDecisionId(scope);

                const newDecision: DecisionNode = {
                    id: rawId,
                    scope,
                    decision,
                    rationale,
                    constraints,
                    status: 'active',
                    createdAt: new Date().toISOString(),
                };

                const { embedded } = await addGlobalDecision(newDecision, getMcpSource());

                if (!embedded) {
                    // Roll back — delete the decision that couldn't be embedded
                    await deleteGlobalDecision(`global:${rawId}`);
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                error: 'Embedding failed — the Gemini API returned an error. The decision was not saved. Check that the API key is valid by running: decide setup',
                            }),
                        }],
                    };
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    decision: { id: `global:${rawId}`, scope, decision },
                                    message: 'Global decision added — applies to all projects',
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            }

            const newId = await getNextDecisionId(scope);

            const newDecision: DecisionNode = {
                id: newId,
                scope,
                decision,
                rationale,
                constraints,
                status: 'active',
                createdAt: new Date().toISOString(),
            };

            const { embedded } = await addDecision(newDecision, getMcpSource());

            if (!embedded) {
                // Roll back — delete the decision that couldn't be embedded
                await deleteDecision(newId);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: 'Embedding failed — the Gemini API returned an error. The decision was not saved. Check that the API key is valid by running: decide setup',
                        }),
                    }],
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                success: true,
                                decision: { id: newId, scope, decision },
                                message: 'Decision added and embedded for search',
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        }

        case 'update_decision': {
            ensureProject(args);
            const { id, ...updates } = args as { id: string; decision?: string; rationale?: string; constraints?: string[]; status?: 'active' | 'deprecated' };

            const updated = isGlobalId(id)
                ? await updateGlobalDecision(id, updates, getMcpSource())
                : await updateDecision(id, updates, getMcpSource());

            if (!updated) {
                return {
                    content: [{ type: 'text', text: JSON.stringify({ error: `Decision ${id} not found` }) }],
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { success: true, decision: updated, message: 'Decision updated and re-embedded' },
                            null,
                            2
                        ),
                    },
                ],
            };
        }

        case 'delete_decision': {
            ensureProject(args);
            const { id } = args as { id: string };

            const deleted = isGlobalId(id)
                ? await deleteGlobalDecision(id, getMcpSource())
                : await deleteDecision(id, getMcpSource());

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ success: deleted, message: deleted ? 'Deleted' : 'Not found' }),
                    },
                ],
            };
        }

        case 'get_history': {
            ensureProject(args);
            const { limit = 10 } = args as { limit?: number };
            const history = await getHistory(limit);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            history.map((e) => ({
                                id: e.id,
                                action: e.action,
                                description: e.description,
                                timestamp: e.timestamp,
                            })),
                            null,
                            2
                        ),
                    },
                ],
            };
        }

        case 'get_status': {
            ensureProject(args);
            const decisions = await listDecisions();
            const history = await getHistory(1);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                project: getCurrentProject(),
                                storePath: getProjectRoot(),
                                totalDecisions: decisions.length,
                                activeDecisions: decisions.filter((d) => d.status === 'active').length,
                                lastActivity: history[0]?.description || 'No activity yet',
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        }

        case 'list_projects': {
            const projects = await listProjects();
            const globalDecisions = await listGlobalDecisions();

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                hint: 'Match project name to the subfolder in the user\'s active file path. Global decisions apply to ALL projects automatically.',
                                global: {
                                    decisions: globalDecisions.length,
                                    note: 'These decisions are included in all project searches',
                                },
                                projects: projects.map((p) => ({
                                    name: p.name,
                                    decisions: p.decisionCount,
                                    scopes: p.scopes,
                                })),
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);
