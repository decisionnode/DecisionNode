#!/usr/bin/env node

import { listDecisions, getDecisionById, addDecision, updateDecision, deleteDecision, deleteScope, getNextDecisionId, renumberDecisions, importDecisions, getAvailableScopes, listProjects, saveDecisions, listGlobalDecisions, getGlobalDecisionById, addGlobalDecision, updateGlobalDecision, deleteGlobalDecision, getNextGlobalDecisionId, getGlobalScopes } from './store.js';
import { DecisionNode } from './types.js';
import { getHistory, getSnapshot, getDecisionsFromSnapshot, logBatchAction, logAction, ActivityLogEntry } from './history.js';
import { getAgentBehavior, setAgentBehavior, AgentBehavior, isGlobalId, getSearchThreshold, setSearchThreshold } from './env.js';
import { loginToCloud, logoutFromCloud, getCloudStatus, syncDecisionsToCloud, getCloudSyncStatus, isProSubscriber, refreshCloudProfile, pullDecisionsFromCloud, detectConflicts, resolveConflict, CloudDecision, SyncConflict, updateSyncMetadata, getAutoSyncEnabled, setAutoSyncEnabled, saveIncomingChanges, removeIncomingChanges } from './cloud.js';
import { getProjectRoot } from './env.js';
import * as readline from 'readline';
import fs from 'fs/promises';
import path from 'path';

const args = process.argv.slice(2);
const command = args[0];

// ─── ANSI styling helpers ───────────────────────────────────
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
    white: '\x1b[97m',
    bgCyan: '\x1b[46m',
    bgYellow: '\x1b[43m',
    black: '\x1b[30m',
};

function banner() {
    console.log('');
    console.log(`  ${c.cyan}╔══════════════════════════════════════╗${c.reset}`);
    console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.cyan}◆${c.reset} ${c.bold}${c.white}Decision${c.yellow}Node${c.reset}                   ${c.cyan}║${c.reset}`);
    console.log(`  ${c.cyan}╚══════════════════════════════════════╝${c.reset}`);
}

function box(lines: string[], color: string = c.cyan) {
    const maxLen = Math.max(...lines.map(l => stripAnsi(l).length));
    const pad = (s: string) => s + ' '.repeat(maxLen - stripAnsi(s).length);
    console.log(`  ${color}┌${'─'.repeat(maxLen + 2)}┐${c.reset}`);
    for (const line of lines) {
        console.log(`  ${color}│${c.reset} ${pad(line)} ${color}│${c.reset}`);
    }
    console.log(`  ${color}└${'─'.repeat(maxLen + 2)}┘${c.reset}`);
}

function stripAnsi(s: string): string {
    return s.replace(/\x1b\[[0-9;]*m/g, '');
}

async function main() {
    try {
        switch (command) {
            case 'list':
                await handleList();
                break;

            case 'get':
                await handleGet();
                break;

            case 'search':
                await handleSearch();
                break;

            case 'add':
            case 'add-decision':
                await handleAddDecision();
                break;

            case 'edit':
                await handleEdit();
                break;

            case 'delete':
                await handleDelete();
                break;

            case 'deprecate':
                await handleDeprecate();
                break;

            case 'activate':
                await handleActivate();
                break;

            case 'import':
                await handleImport();
                break;

            case 'history':
                await handleHistory();
                break;

            case 'init':
                await handleInit();
                break;

            case 'setup':
                await handleSetup();
                break;

            case 'embed':
                await handleEmbed();
                break;

            case 'check':
                await handleCheck();
                break;

            case 'clean':
                await handleClean();
                break;

            case 'export':
                await handleExport();
                break;

            // case 'marketplace':
            // case 'market':
            //     await handleMarketplace();
            //     break;

            case 'projects':
                await handleProjects();
                break;

            case 'config':
                await handleConfig();
                break;

            // case 'login':
            //     await handleLogin();
            //     break;

            // case 'logout':
            //     await handleLogout();
            //     break;

            // case 'status':
            //     await handleStatus();
            //     break;

            // case 'sync':
            //     await handleSync();
            //     break;

            // case 'cloud':
            //     await handleCloud();
            //     break;

            // case 'conflicts':
            //     await handleConflicts();
            //     break;

            // case 'fetch':
            //     await handleFetch();
            //     break;

            // case 'pull':
            //     await handlePull();
            //     break;

            case 'delete-scope':
                await handleDeleteScope();
                break;

            case 'ui':
                await handleUi();
                break;

            default:
                printUsage();
                break;
        }
    } catch (error) {
        console.error(`\n  ${c.red}✗${c.reset} ${(error as Error).message}\n`);
        process.exit(1);
    }
}

async function handleList() {
    const scopeFlag = args.indexOf('--scope');
    const scope = scopeFlag > -1 ? args[scopeFlag + 1] : undefined;
    const globalOnly = args.includes('--global');

    // Get project decisions (unless --global flag is set)
    const projectDecisions = globalOnly ? [] : await listDecisions(scope);

    // Get global decisions (always, unless --scope is filtering a project scope)
    const globalDecisions = globalOnly
        ? await listGlobalDecisions(scope)
        : await listGlobalDecisions();

    const allDecisions = [...projectDecisions, ...globalDecisions];

    if (allDecisions.length === 0) {
        console.log(`\n  ${c.dim}No decisions found.${c.reset}`);
        console.log(`  Run: ${c.cyan}decide add${c.reset}\n`);
        return;
    }

    const label = globalOnly ? 'Global Decisions' : `Decisions${scope ? ` (${scope})` : ''}`;
    console.log(`\n  ${c.bold}${c.white}${label}${c.reset}\n`);

    // Show global decisions first, then project decisions
    if (globalDecisions.length > 0) {
        const globalGrouped: Record<string, DecisionNode[]> = {};
        for (const d of globalDecisions) {
            if (!globalGrouped[d.scope]) globalGrouped[d.scope] = [];
            globalGrouped[d.scope].push(d);
        }

        console.log(`  ${c.yellow}● Global${c.reset}`);
        for (const [scopeName, scopeDecisions] of Object.entries(globalGrouped)) {
            console.log(`    ${c.dim}${scopeName}${c.reset}`);
            for (const d of scopeDecisions) {
                const status = d.status === 'active' ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
                console.log(`      ${status} ${c.cyan}${d.id}${c.reset} ${d.decision}`);
            }
        }
        console.log('');
    }

    if (projectDecisions.length > 0) {
        const grouped: Record<string, DecisionNode[]> = {};
        for (const d of projectDecisions) {
            if (!grouped[d.scope]) grouped[d.scope] = [];
            grouped[d.scope].push(d);
        }

        for (const [scopeName, scopeDecisions] of Object.entries(grouped)) {
            console.log(`  ${c.dim}${scopeName}${c.reset}`);
            for (const d of scopeDecisions) {
                const status = d.status === 'active' ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
                console.log(`    ${status} ${c.cyan}${d.id}${c.reset} ${d.decision}`);
            }
            console.log('');
        }
    }

    const parts = [];
    if (projectDecisions.length > 0) parts.push(`${projectDecisions.length} project`);
    if (globalDecisions.length > 0) parts.push(`${globalDecisions.length} global`);
    console.log(`  ${c.dim}${parts.join(' + ')} decisions${c.reset}\n`);
}

async function handleGet() {
    const id = args[1];
    if (!id) {
        console.log(`\n  ${c.dim}Usage:${c.reset} ${c.cyan}decide get${c.reset} ${c.gray}<decision-id>${c.reset}\n`);
        return;
    }

    const decision = isGlobalId(id)
        ? await getGlobalDecisionById(id)
        : await getDecisionById(id);

    if (!decision) {
        console.log(`\n  ${c.red}✗${c.reset} Decision "${id}" not found\n`);
        return;
    }

    const statusColor = decision.status === 'active' ? c.green : c.dim;
    console.log('');
    console.log(`  ${c.cyan}${c.bold}${decision.id}${c.reset}  ${statusColor}${decision.status}${c.reset}`);
    console.log(`  ${c.gray}${'─'.repeat(50)}${c.reset}`);
    console.log(`  ${c.white}${decision.decision}${c.reset}`);
    if (decision.rationale) {
        console.log(`  ${c.dim}Rationale:${c.reset} ${decision.rationale}`);
    }
    console.log(`  ${c.dim}Scope:${c.reset} ${decision.scope}`);
    if (decision.constraints?.length) {
        console.log(`  ${c.dim}Constraints:${c.reset} ${decision.constraints.join(', ')}`);
    }
    console.log('');
}

async function handleSearch() {
    const query = args.slice(1).join(' ');
    if (!query) {
        console.log(`\n  ${c.dim}Usage:${c.reset} ${c.cyan}decide search${c.reset} ${c.gray}"your question"${c.reset}\n`);
        return;
    }

    try {
        const { findRelevantDecisions } = await import('./ai/rag.js');
        const results = await findRelevantDecisions(query, 5);

        if (results.length === 0) {
            console.log(`\n  ${c.dim}No relevant decisions found.${c.reset}`);
            console.log(`  ${c.dim}Have you added decisions yet?${c.reset}\n`);
            return;
        }

        console.log('');

        for (const result of results) {
            const score = (result.score * 100).toFixed(0);
            const scoreColor = Number(score) >= 80 ? c.green : Number(score) >= 60 ? c.yellow : c.dim;
            console.log(`  ${scoreColor}${score}%${c.reset}  ${c.cyan}${result.decision.id}${c.reset}  ${result.decision.decision}`);
        }
        console.log('');
    } catch (error) {
        console.log(`\n  ${c.red}✗${c.reset} Semantic search requires a Gemini API key.`);
        console.log(`  Run: ${c.cyan}decide setup${c.reset}\n`);
    }
}

function readHidden(promptText: string): Promise<string> {
    return new Promise((resolve) => {
        process.stderr.write(promptText);
        const stdin = process.stdin;
        const wasRaw = stdin.isRaw;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf-8');

        let input = '';
        const onData = (ch: string) => {
            if (ch === '\r' || ch === '\n') {
                stdin.setRawMode(wasRaw ?? false);
                stdin.pause();
                stdin.removeListener('data', onData);
                resolve(input);
            } else if (ch === '\u0003') {
                // Ctrl+C
                process.exit(0);
            } else if (ch === '\u007f' || ch === '\b') {
                // Backspace
                input = input.slice(0, -1);
            } else {
                input += ch;
            }
        };
        stdin.on('data', onData);
    });
}

function prompt(question: string, defaultValue?: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
        if (defaultValue) {
            rl.write(defaultValue);
        }
    });
}

function getFlag(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return undefined;
    return args[idx + 1];
}

async function handleAddDecision() {
    const isGlobal = args.includes('--global');

    // Check for inline mode: decide add --scope UI --decision "Use Tailwind" ...
    const inlineScope = getFlag('--scope') || getFlag('-s');
    const inlineDecision = getFlag('--decision') || getFlag('-d');

    let scope: string;
    let decisionText: string;
    let rationale: string;
    let constraintsInput: string;

    if (inlineScope && inlineDecision) {
        // Inline mode — no prompts
        scope = inlineScope;
        decisionText = inlineDecision;
        rationale = getFlag('--rationale') || getFlag('-r') || '';
        constraintsInput = getFlag('--constraints') || getFlag('-c') || '';

        // Conflict check for inline mode too
        if (!args.includes('--force')) {
            try {
                const { findPotentialConflicts } = await import('./ai/rag.js');
                const conflicts = await findPotentialConflicts(`${scope}: ${decisionText}`, 0.75);

                if (conflicts.length > 0) {
                    console.log(`\n  ${c.yellow}!${c.reset} ${c.bold}Similar decisions found:${c.reset}\n`);
                    for (const { decision, score } of conflicts) {
                        const similarity = Math.round(score * 100);
                        console.log(`    ${c.yellow}${similarity}%${c.reset}  ${c.cyan}${decision.id}${c.reset}  ${decision.decision.substring(0, 50)}...`);
                    }
                    console.log('');
                    const proceed = await prompt(`  Continue anyway? ${c.dim}(y/N):${c.reset} `);
                    if (proceed.toLowerCase() !== 'y') {
                        console.log(`  ${c.dim}Cancelled.${c.reset}\n`);
                        return;
                    }
                }
            } catch {
                // Conflict check failed (API key not set) - continue anyway
            }
        }
    } else {
        // Interactive mode
        console.log(`\n  ${c.bold}${c.white}New ${isGlobal ? 'Global ' : ''}Decision${c.reset}\n`);

        // Show existing scopes for consistency
        const existingScopes = isGlobal ? await getGlobalScopes() : await getAvailableScopes();
        if (existingScopes.length > 0) {
            console.log(`  ${c.dim}Existing scopes:${c.reset} ${c.cyan}${existingScopes.join(', ')}${c.reset}\n`);
        }

        const scopeExamples = existingScopes.length > 0
            ? existingScopes.slice(0, 3).join(', ')
            : 'UI, Backend, API';
        scope = await prompt(`  ${c.yellow}▸${c.reset} Scope (e.g., ${scopeExamples}): `);
        if (!scope.trim()) {
            console.log(`  ${c.red}✗${c.reset} Scope is required\n`);
            return;
        }

        decisionText = await prompt(`  ${c.yellow}▸${c.reset} Decision: `);
        if (!decisionText.trim()) {
            console.log(`  ${c.red}✗${c.reset} Decision text is required\n`);
            return;
        }

        // Check for potential conflicts with existing decisions
        try {
            const { findPotentialConflicts } = await import('./ai/rag.js');
            const conflicts = await findPotentialConflicts(`${scope}: ${decisionText}`, 0.75);

            if (conflicts.length > 0) {
                console.log(`\n  ${c.yellow}!${c.reset} ${c.bold}Similar decisions found:${c.reset}\n`);
                for (const { decision, score } of conflicts) {
                    const similarity = Math.round(score * 100);
                    console.log(`    ${c.yellow}${similarity}%${c.reset}  ${c.cyan}${decision.id}${c.reset}  ${decision.decision.substring(0, 50)}...`);
                }
                console.log('');
                const proceed = await prompt(`  Continue anyway? ${c.dim}(y/N):${c.reset} `);
                if (proceed.toLowerCase() !== 'y') {
                    console.log(`  ${c.dim}Cancelled.${c.reset}\n`);
                    return;
                }
            }
        } catch {
            // Conflict check failed (API key not set) - continue anyway
        }

        rationale = await prompt(`  ${c.yellow}▸${c.reset} Rationale ${c.dim}(optional):${c.reset} `);
        constraintsInput = await prompt(`  ${c.yellow}▸${c.reset} Constraints ${c.dim}(comma-separated, optional):${c.reset} `);
    }

    if (isGlobal) {
        const rawId = await getNextGlobalDecisionId(scope.trim());

        const newDecision: DecisionNode = {
            id: rawId,
            scope: scope.trim(),
            decision: decisionText.trim(),
            rationale: rationale.trim() || undefined,
            constraints: constraintsInput.trim() ? constraintsInput.split(',').map(s => s.trim()) : undefined,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        const { embedded } = await addGlobalDecision(newDecision);

        console.log(`\n  ${c.green}✓${c.reset} Created ${c.cyan}global:${rawId}${c.reset}`);
        console.log(`  ${c.dim}Applies to all projects${c.reset}`);
        if (embedded) {
            console.log(`  ${c.dim}Embedded for semantic search${c.reset}`);
        } else {
            console.log(`\n  ${c.yellow}!${c.reset} Not embedded — run ${c.cyan}decide setup${c.reset} then ${c.cyan}decide embed${c.reset}`);
        }
    } else {
        const id = await getNextDecisionId(scope.trim());

        const newDecision: DecisionNode = {
            id,
            scope: scope.trim(),
            decision: decisionText.trim(),
            rationale: rationale.trim() || undefined,
            constraints: constraintsInput.trim() ? constraintsInput.split(',').map(s => s.trim()) : undefined,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        const { embedded } = await addDecision(newDecision);

        console.log(`\n  ${c.green}✓${c.reset} Created ${c.cyan}${id}${c.reset}`);
        if (embedded) {
            console.log(`  ${c.dim}Embedded for semantic search${c.reset}`);
        } else {
            console.log(`\n  ${c.yellow}!${c.reset} Not embedded — run ${c.cyan}decide setup${c.reset} then ${c.cyan}decide embed${c.reset}`);
        }
    }
}

async function handleEdit() {
    const id = args[1];
    if (!id) {
        console.log(`\n  ${c.dim}Usage:${c.reset} ${c.cyan}decide edit${c.reset} ${c.gray}<decision-id>${c.reset}\n`);
        return;
    }

    const global = isGlobalId(id);
    const decision = global
        ? await getGlobalDecisionById(id)
        : await getDecisionById(id);

    if (!decision) {
        console.log(`\n  ${c.red}✗${c.reset} Decision "${id}" not found\n`);
        return;
    }

    const force = args.includes('--force') || args.includes('-f');

    if (global && !force) {
        console.log(`\n  ${c.yellow}!${c.reset} This is a global decision that affects ${c.bold}all projects${c.reset}.`);
        const confirm = await prompt(`  Continue editing? ${c.dim}(y/N):${c.reset} `);
        if (confirm.trim().toLowerCase() !== 'y') {
            console.log(`  ${c.dim}Cancelled.${c.reset}\n`);
            return;
        }
    }

    console.log(`\n  ${c.bold}${c.white}Editing${c.reset} ${c.cyan}${id}${c.reset}`);
    console.log(`  ${c.dim}Press Enter to keep current value.${c.reset}\n`);

    const newDecision = await prompt('Decision: ', decision.decision);
    const newRationale = await prompt('Rationale: ', decision.rationale || '');
    const newConstraints = await prompt('Constraints: ', (decision.constraints || []).join(', '));

    const updates: Partial<DecisionNode> = {};
    if (newDecision.trim()) updates.decision = newDecision.trim();
    if (newRationale.trim()) updates.rationale = newRationale.trim();
    if (newConstraints.trim()) updates.constraints = newConstraints.split(',').map(s => s.trim());

    if (Object.keys(updates).length === 0) {
        console.log(`\n  ${c.dim}No changes made.${c.reset}\n`);
        return;
    }

    if (global) {
        await updateGlobalDecision(id, updates);
    } else {
        await updateDecision(id, updates);
    }
    console.log(`\n  ${c.green}✓${c.reset} Updated ${c.cyan}${id}${c.reset}`);
    console.log(`  ${c.dim}Embedded for semantic search${c.reset}\n`);
}

async function handleDelete() {
    const id = args[1];
    if (!id) {
        console.log(`\n  ${c.dim}Usage:${c.reset} ${c.cyan}decide delete${c.reset} ${c.gray}<decision-id>${c.reset}\n`);
        return;
    }

    const global = isGlobalId(id);
    const decision = global
        ? await getGlobalDecisionById(id)
        : await getDecisionById(id);

    if (!decision) {
        console.log(`\n  ${c.red}✗${c.reset} Decision "${id}" not found\n`);
        return;
    }

    console.log(`\n  ${c.red}${c.bold}Delete${c.reset} ${c.cyan}${id}${c.reset}`);
    console.log(`  ${c.dim}"${decision.decision}"${c.reset}\n`);

    if (global) {
        console.log(`  ${c.yellow}!${c.reset} This is a global decision that affects ${c.bold}all projects${c.reset}.`);
    }

    const force = args.includes('--force') || args.includes('-f');

    if (!force) {
        const confirm = await prompt(`  Type ${c.bold}"yes"${c.reset} to confirm: `);
        if (confirm.trim().toLowerCase() !== 'yes') {
            console.log(`  ${c.dim}Cancelled.${c.reset}\n`);
            return;
        }
    }

    if (global) {
        await deleteGlobalDecision(id);
    } else {
        await deleteDecision(id);

        // Auto-clean orphaned data (reviews, etc.)
        try {
            const { cleanOrphanedData } = await import('./maintenance.js');
            await cleanOrphanedData();
        } catch {
            // Ignore clean errors during delete flow
        }

        if (!force) {
            const renumber = await prompt('Renumber remaining decisions? (y/n): ');
            if (renumber.trim().toLowerCase() === 'y') {
                const renames = await renumberDecisions(decision.scope);
                if (renames.length > 0) {
                    console.log('\nRenumbered:');
                    renames.forEach(r => console.log(`   ${r}`));
                }
            }
        }
    }

    console.log(`\n  ${c.green}✓${c.reset} Deleted ${c.cyan}${id}${c.reset}\n`);
}

async function handleDeprecate() {
    const id = args[1];
    if (!id) {
        console.log(`\n  ${c.dim}Usage:${c.reset} ${c.cyan}decide deprecate${c.reset} ${c.gray}<decision-id>${c.reset}\n`);
        return;
    }

    const global = isGlobalId(id);
    const decision = global
        ? await getGlobalDecisionById(id)
        : await getDecisionById(id);

    if (!decision) {
        console.log(`\n  ${c.red}✗${c.reset} Decision "${id}" not found\n`);
        return;
    }

    if (decision.status === 'deprecated') {
        console.log(`\n  ${c.yellow}!${c.reset} ${c.cyan}${id}${c.reset} is already deprecated.\n`);
        return;
    }

    console.log(`\n  ${c.cyan}${id}${c.reset}  ${decision.decision}`);

    if (global) {
        await updateGlobalDecision(id, { status: 'deprecated' });
    } else {
        await updateDecision(id, { status: 'deprecated' });
    }

    console.log(`  ${c.green}✓${c.reset} Deprecated — hidden from search results\n`);
}

async function handleActivate() {
    const id = args[1];
    if (!id) {
        console.log(`\n  ${c.dim}Usage:${c.reset} ${c.cyan}decide activate${c.reset} ${c.gray}<decision-id>${c.reset}\n`);
        return;
    }

    const global = isGlobalId(id);
    const decision = global
        ? await getGlobalDecisionById(id)
        : await getDecisionById(id);

    if (!decision) {
        console.log(`\n  ${c.red}✗${c.reset} Decision "${id}" not found\n`);
        return;
    }

    if (decision.status === 'active') {
        console.log(`\n  ${c.yellow}!${c.reset} ${c.cyan}${id}${c.reset} is already active.\n`);
        return;
    }

    console.log(`\n  ${c.cyan}${id}${c.reset}  ${decision.decision}`);

    if (global) {
        await updateGlobalDecision(id, { status: 'active' });
    } else {
        await updateDecision(id, { status: 'active' });
    }

    console.log(`  ${c.green}✓${c.reset} Activated — now appears in search results\n`);
}

async function handleDeleteScope() {
    const scopeArg = args[1];

    if (!scopeArg) {
        console.log(`\n  ${c.dim}Usage:${c.reset} ${c.cyan}decide delete-scope${c.reset} ${c.gray}<scope>${c.reset}\n`);
        return;
    }

    const scopes = await getAvailableScopes();
    const normalizedInput = scopeArg.charAt(0).toUpperCase() + scopeArg.slice(1).toLowerCase();

    if (!scopes.some(s => s.toLowerCase() === scopeArg.toLowerCase())) {
        console.log(`\n  ${c.red}✗${c.reset} Scope "${scopeArg}" not found.`);
        console.log(`  ${c.dim}Available:${c.reset} ${c.cyan}${scopes.join(', ')}${c.reset}\n`);
        return;
    }

    const decisions = await listDecisions(normalizedInput);
    const force = args.includes('--force') || args.includes('-f');

    console.log(`\n  ${c.red}${c.bold}Delete scope${c.reset} ${c.cyan}${normalizedInput}${c.reset} ${c.dim}(${decisions.length} decisions)${c.reset}\n`);
    decisions.forEach(d => console.log(`    ${c.dim}─${c.reset} ${c.cyan}${d.id}${c.reset}  ${d.decision.substring(0, 50)}`));

    if (!force) {
        console.log(`\n  ${c.yellow}!${c.reset} This cannot be undone.`);
        const confirm = await prompt(`  Type the scope name to confirm: `);

        if (confirm.toLowerCase() !== scopeArg.toLowerCase() && confirm.toLowerCase() !== normalizedInput.toLowerCase()) {
            console.log(`  ${c.dim}Cancelled.${c.reset}\n`);
            return;
        }
    }

    const result = await deleteScope(scopeArg);
    console.log(`\n  ${c.green}✓${c.reset} Deleted scope ${c.cyan}${normalizedInput}${c.reset} ${c.dim}(${result.deleted} decisions)${c.reset}\n`);
}

async function handleImport() {
    const globalFlag = args.includes('--global');
    const filePath = args.find(a => a !== 'import' && a !== '--global' && a !== '--overwrite' && !a.startsWith('-'));
    if (!filePath) {
        console.log(`\n  ${c.dim}Usage:${c.reset} ${c.cyan}decide import${c.reset} ${c.gray}<file.json>${c.reset} ${c.dim}[--global] [--overwrite]${c.reset}\n`);
        return;
    }

    console.log(`\n  ${c.bold}${c.white}Importing${c.reset} ${c.dim}${filePath}${globalFlag ? ' (global)' : ''}${c.reset}`);

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Support both array and {decisions: [...]} format
        const decisions: DecisionNode[] = Array.isArray(data) ? data : data.decisions;

        if (!decisions || decisions.length === 0) {
            console.log(`  ${c.red}✗${c.reset} No decisions found in file\n`);
            return;
        }

        const overwriteFlag = args.includes('--overwrite');

        if (globalFlag) {
            let added = 0;
            let skipped = 0;
            for (const decision of decisions) {
                try {
                    await addGlobalDecision(decision);
                    added++;
                } catch {
                    skipped++;
                }
            }
            console.log(`\n  ${c.green}✓${c.reset} Import complete ${c.dim}(global)${c.reset}`);
            console.log(`    ${c.green}${added}${c.reset} added  ${c.dim}${skipped} skipped${c.reset}\n`);
        } else {
            const result = await importDecisions(decisions, { overwrite: overwriteFlag });
            console.log(`\n  ${c.green}✓${c.reset} Import complete`);
            console.log(`    ${c.green}${result.added}${c.reset} added  ${c.dim}${result.skipped} skipped  ${result.embedded} embedded${c.reset}\n`);
        }
    } catch (error) {
        console.log(`\n  ${c.red}✗${c.reset} Import failed: ${(error as Error).message}\n`);
    }
}

async function handleHistory() {
    const entryId = args[1];

    if (entryId && !entryId.startsWith('-')) {
        // View specific snapshot
        const entry = await getSnapshot(entryId);
        if (!entry) {
            console.log(`❌ Entry ${entryId} not found`);
            return;
        }

        console.log(`\n  ${c.bold}${c.white}Snapshot${c.reset} ${c.cyan}${entry.id}${c.reset}`);
        console.log(`  ${c.dim}Action:${c.reset} ${entry.action}  ${c.dim}Time:${c.reset} ${new Date(entry.timestamp).toLocaleString()}`);
        console.log(`  ${c.dim}${entry.description}${c.reset}\n`);

        const decisions = getDecisionsFromSnapshot(entry.snapshot);
        console.log(`  ${c.dim}Decisions at this point (${decisions.length}):${c.reset}\n`);

        for (const d of decisions) {
            console.log(`  ${c.cyan}${d.id}${c.reset}  ${d.decision}`);
            if (d.rationale) console.log(`    ${c.dim}Rationale:${c.reset} ${d.rationale}`);
            if (d.constraints?.length) console.log(`    ${c.dim}Constraints:${c.reset} ${d.constraints.join(', ')}`);
            console.log(`    ${c.dim}Status:${c.reset} ${d.status}`);
        }
        console.log('');
        return;
    }

    // List recent history
    const filterIndex = args.indexOf('--filter');
    const filter = filterIndex > -1 ? args[filterIndex + 1] : undefined;

    const history = await getHistory(50); // Get last 50 entries

    let displayedHistory = history;
    if (filter) {
        const validFilters = ['cloud', 'cli', 'mcp', 'marketplace'];
        if (!validFilters.includes(filter) && !filter.startsWith('mcp:')) {
            console.log(`❌ Invalid filter: ${filter}`);
            console.log(`   Valid options: ${validFilters.join(', ')}`);
            return;
        }
        displayedHistory = history.filter(h =>
            filter === 'mcp' ? h.source?.startsWith('mcp') : h.source === filter
        );
    }

    if (displayedHistory.length === 0) {
        console.log(`\n  ${c.dim}No history found${filter ? ` for "${filter}"` : ''}.${c.reset}\n`);
        return;
    }

    console.log(`\n  ${c.bold}${c.white}Activity History${c.reset}${filter ? ` ${c.dim}(${filter})${c.reset}` : ''}\n`);

    displayedHistory.forEach(entry => {
        const date = new Date(entry.timestamp).toLocaleString();
        const icon = getActionIcon(entry.action);
        const rawSource = entry.source || 'cli';
        const source = rawSource.startsWith('mcp:') ? rawSource.replace('mcp:', '') : rawSource.toUpperCase();
        const isMcp = rawSource.startsWith('mcp');
        const sourceBadge = isMcp ? `${c.cyan}${source.padEnd(14)}${c.reset}` : `${c.gray}${source.padEnd(14)}${c.reset}`;
        const desc = colorizeDescription(entry.description);

        console.log(`  ${icon} ${c.dim}${date}${c.reset}  ${sourceBadge}  ${desc}`);
    });
    console.log('');
}

function getActionIcon(action: string): string {
    switch (action) {
        case 'added': return `${c.green}+${c.reset}`;
        case 'updated': return `${c.yellow}~${c.reset}`;
        case 'deleted': return `${c.red}-${c.reset}`;
        case 'imported': return `${c.cyan}↓${c.reset}`;
        case 'installed': return `${c.cyan}■${c.reset}`;
        case 'cloud_push': return `${c.cyan}↑${c.reset}`;
        case 'cloud_pull': return `${c.cyan}↓${c.reset}`;
        case 'conflict_resolved': return `${c.yellow}⇔${c.reset}`;
        default: return `${c.dim}·${c.reset}`;
    }
}

function colorizeDescription(desc: string): string {
    // Colorize action word
    const actions: Record<string, string> = {
        'Added': c.green,
        'Updated': c.yellow,
        'Deleted': c.red,
        'Deprecated': c.yellow,
        'Activated': c.green,
        'Imported': c.cyan,
        'Installed': c.cyan,
    };
    for (const [word, color] of Object.entries(actions)) {
        if (desc.startsWith(word)) {
            const rest = desc.slice(word.length);
            // Colorize decision IDs in the rest
            const colored = rest.replace(/((?:global:)?[\w]+-\d+)/g, `${c.cyan}$1${c.reset}`);
            return `${color}${word}${c.reset}${colored}`;
        }
    }
    return desc;
}

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

async function handleInit() {
    const cwd = process.cwd();
    const projectName = path.basename(cwd);

    banner();
    console.log('');
    console.log(`  ${c.gray}Project:${c.reset}  ${c.bold}${projectName}${c.reset}`);
    console.log(`  ${c.gray}Path:${c.reset}     ${c.dim}${cwd}${c.reset}`);
    console.log('');

    // Check if already initialized by looking for existing decisions
    const existingScopes = await getAvailableScopes();
    if (existingScopes.length > 0) {
        console.log(`  ${c.green}✓${c.reset} Already initialized with ${c.bold}${existingScopes.length}${c.reset} scope(s): ${c.cyan}${existingScopes.join(', ')}${c.reset}`);
        console.log(`\n  Run: ${c.cyan}decide list${c.reset}`);
        console.log('');
        return;
    }

    // Create the .decisions directory
    const { getProjectRoot } = await import('./env.js');
    const projectRoot = getProjectRoot();
    await fs.mkdir(projectRoot, { recursive: true });

    console.log(`  ${c.green}✓${c.reset} Initialized\n`);

    box([
        `${c.bold}${c.white}Next steps${c.reset}`,
        '',
        `${c.yellow}1.${c.reset} Configure your API key`,
        `   ${c.cyan}decide setup${c.reset}`,
        '',
        `${c.yellow}2.${c.reset} Connect your AI client`,
        `   ${c.dim}Claude Code:${c.reset}  ${c.cyan}claude mcp add decisionnode -s user decide-mcp${c.reset}`,
        `   ${c.dim}Cursor:${c.reset}       ${c.dim}Add decide-mcp in Settings → MCP${c.reset}`,
        `   ${c.dim}Windsurf:${c.reset}     ${c.dim}Add decide-mcp in Settings → MCP${c.reset}`,
        '',
        `${c.yellow}3.${c.reset} Add your first decision`,
        `   ${c.cyan}decide add${c.reset}`,
    ]);
    console.log('');
}

async function handleSetup() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const envPath = path.join(homeDir, '.decisionnode', '.env');
    const envDir = path.dirname(envPath);

    banner();
    console.log('');
    console.log(`  ${c.gray}Semantic search requires a Gemini API key (free tier).${c.reset}`);
    console.log(`  ${c.dim}Get one at:${c.reset} ${c.cyan}https://aistudio.google.com/${c.reset}`);
    console.log('');

    // Check if key already exists
    let existingKey = process.env.GEMINI_API_KEY || '';
    if (!existingKey) {
        try {
            const content = await fs.readFile(envPath, 'utf-8');
            const match = content.match(/GEMINI_API_KEY=(.+)/);
            if (match) existingKey = match[1].trim();
        } catch { /* no existing file */ }
    }

    if (existingKey) {
        const masked = existingKey.slice(0, 8) + '...' + existingKey.slice(-4);
        console.log(`  ${c.gray}Current key:${c.reset} ${c.dim}${masked}${c.reset}`);
        console.log('');
    }

    const promptText = existingKey ? `  ${c.yellow}▸${c.reset} New API key (enter to keep current): ` : `  ${c.yellow}▸${c.reset} Gemini API key: `;
    const key = await readHidden(promptText);
    console.log(''); // newline after hidden input

    if (!key && existingKey) {
        console.log(`  ${c.green}✓${c.reset} Keeping existing key.`);
        console.log('');
        return;
    }

    if (!key) {
        console.log(`  ${c.yellow}!${c.reset} No key provided. Run ${c.cyan}decide setup${c.reset} again later.`);
        console.log('');
        return;
    }

    // Write the .env file
    await fs.mkdir(envDir, { recursive: true });

    let envContent = '';
    try {
        envContent = await fs.readFile(envPath, 'utf-8');
    } catch { /* file doesn't exist yet */ }

    if (envContent.includes('GEMINI_API_KEY=')) {
        envContent = envContent.replace(/GEMINI_API_KEY=.+/, `GEMINI_API_KEY=${key}`);
    } else {
        envContent = envContent ? envContent.trimEnd() + '\n' + `GEMINI_API_KEY=${key}\n` : `GEMINI_API_KEY=${key}\n`;
    }

    await fs.writeFile(envPath, envContent, 'utf-8');
    process.env.GEMINI_API_KEY = key;

    console.log(`  ${c.green}✓${c.reset} API key saved\n`);

    box([
        `${c.bold}${c.white}Ready to go${c.reset}`,
        '',
        `${c.cyan}decide add${c.reset}              ${c.dim}Record a decision${c.reset}`,
        `${c.cyan}decide search "query"${c.reset}    ${c.dim}Semantic search${c.reset}`,
    ]);
    console.log('');
}

async function handleEmbed() {
    console.log(`\n  ${c.bold}${c.white}Embedding decisions${c.reset}\n`);

    try {
        const { getUnembeddedDecisions, embedAllDecisions } = await import('./ai/rag.js');
        const unembedded = await getUnembeddedDecisions();

        if (unembedded.length === 0) {
            console.log(`  ${c.green}✓${c.reset} All decisions are embedded.\n`);
            return;
        }

        console.log(`  ${c.yellow}${unembedded.length}${c.reset} unembedded decisions:`);
        unembedded.forEach(d => console.log(`    ${c.dim}─${c.reset} ${c.cyan}${d.id}${c.reset}`));
        console.log(`\n  ${c.dim}Generating embeddings...${c.reset}`);
        const result = await embedAllDecisions();

        if (result.embedded.length > 0) {
            console.log(`  ${c.green}✓${c.reset} Embedded: ${c.cyan}${result.embedded.join(', ')}${c.reset}`);
        }
        if (result.failed.length > 0) {
            console.log(`  ${c.red}✗${c.reset} Failed: ${result.failed.join(', ')}`);
        }
        console.log('');
    } catch (error) {
        console.log(`  ${c.red}✗${c.reset} Requires a Gemini API key.`);
        console.log(`  Run: ${c.cyan}decide setup${c.reset}\n`);
        process.exit(1);
    }
}

async function handleCheck() {
    console.log(`\n  ${c.bold}${c.white}Health Check${c.reset}\n`);

    const { loadVectorCache, loadGlobalVectorCache } = await import('./ai/rag.js');

    const projectDecisions = await listDecisions();
    const projectCache = await loadVectorCache();
    const projectMissing = projectDecisions.filter(d => !projectCache[d.id]);
    const projectEmbedded = projectDecisions.length - projectMissing.length;

    console.log(`  ${c.dim}Project${c.reset}  ${c.green}${projectEmbedded}${c.reset} embedded  ${projectMissing.length > 0 ? `${c.yellow}${projectMissing.length}${c.reset} missing` : `${c.dim}0 missing${c.reset}`}`);
    if (projectMissing.length > 0) {
        projectMissing.forEach(d => console.log(`    ${c.yellow}!${c.reset} ${c.cyan}${d.id}${c.reset}  ${d.decision.substring(0, 50)}`));
    }

    const globalDecs = await listGlobalDecisions();
    let globalMissingCount = 0;
    if (globalDecs.length > 0) {
        const globalCache = await loadGlobalVectorCache();
        const globalMissing = globalDecs.filter(d => {
            const rawId = d.id.replace(/^global:/, '');
            return !globalCache[rawId];
        });
        globalMissingCount = globalMissing.length;
        const globalEmbedded = globalDecs.length - globalMissing.length;

        console.log(`  ${c.dim}Global${c.reset}   ${c.green}${globalEmbedded}${c.reset} embedded  ${globalMissing.length > 0 ? `${c.yellow}${globalMissing.length}${c.reset} missing` : `${c.dim}0 missing${c.reset}`}`);
        if (globalMissing.length > 0) {
            globalMissing.forEach(d => console.log(`    ${c.yellow}!${c.reset} ${c.cyan}${d.id}${c.reset}  ${d.decision.substring(0, 50)}`));
        }
    }

    const totalMissing = projectMissing.length + globalMissingCount;
    if (totalMissing > 0) {
        console.log(`\n  ${c.yellow}${totalMissing}${c.reset} not searchable. Run: ${c.cyan}decide embed${c.reset}\n`);
    } else {
        console.log(`\n  ${c.green}✓${c.reset} All decisions embedded and searchable.\n`);
    }
}

async function handleClean() {
    console.log(`\n  ${c.bold}${c.white}Cleaning${c.reset}\n`);
    try {
        const { cleanOrphanedData } = await import('./maintenance.js');
        const result = await cleanOrphanedData();

        if (result.vectorsRemoved === 0 && result.reviewsRemoved === 0) {
            console.log(`  ${c.green}✓${c.reset} Nothing to clean.\n`);
        } else {
            if (result.vectorsRemoved > 0) {
                console.log(`  ${c.green}✓${c.reset} Removed ${result.vectorsRemoved} orphaned vectors`);
            }
            if (result.reviewsRemoved > 0) {
                console.log(`  ${c.green}✓${c.reset} Removed ${result.reviewsRemoved} orphaned reviews`);
            }
            console.log('');
        }
    } catch (error) {
        console.error(`  ${c.red}✗${c.reset} ${(error as Error).message}\n`);
        process.exit(1);
    }
}

async function handleExport() {
    const globalOnly = args.includes('--global');
    const formatArg = args.find(a => a !== '--global' && a !== 'export');
    const format = formatArg?.toLowerCase() || 'md';
    const decisions = globalOnly ? await listGlobalDecisions() : await listDecisions();

    if (decisions.length === 0) {
        console.error('No decisions to export.');
        return;
    }

    let output: string;

    switch (format) {
        case 'json':
            output = JSON.stringify(decisions, null, 2);
            break;

        case 'csv':
            output = exportToCSV(decisions);
            break;

        case 'md':
        case 'markdown':
        default:
            output = exportToMarkdown(decisions);
            break;
    }

    console.log(output);
}

function exportToMarkdown(decisions: DecisionNode[]): string {
    const grouped = new Map<string, DecisionNode[]>();

    for (const d of decisions) {
        const scope = d.scope.charAt(0).toUpperCase() + d.scope.slice(1);
        if (!grouped.has(scope)) grouped.set(scope, []);
        grouped.get(scope)!.push(d);
    }

    let md = '# Project Decisions\n\n';
    md += `> Generated by DecisionNode on ${new Date().toLocaleDateString()}\n\n`;

    for (const [scope, items] of grouped) {
        md += `## ${scope}\n\n`;
        for (const d of items) {
            md += `### ${d.id}\n\n`;
            md += `**Decision:** ${d.decision}\n\n`;
            if (d.rationale) md += `**Rationale:** ${d.rationale}\n\n`;
            if (d.constraints?.length) {
                md += '**Constraints:**\n';
                d.constraints.forEach(c => md += `- ${c}\n`);
                md += '\n';
            }
            md += `---\n\n`;
        }
    }

    return md;
}

function exportToCSV(decisions: DecisionNode[]): string {
    const headers = ['id', 'scope', 'decision', 'rationale', 'constraints', 'status', 'createdAt'];
    const rows = decisions.map(d => [
        d.id,
        d.scope,
        `"${d.decision.replace(/"/g, '""')}"`,
        d.rationale ? `"${d.rationale.replace(/"/g, '""')}"` : '',
        (d.constraints || []).join('; '),
        d.status,
        d.createdAt
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

async function handleMarketplace() {
    const subCommand = args[1];
    const { getMarketplaceIndex, searchMarketplace, installPack } = await import('./marketplace.js');

    switch (subCommand) {
        case 'browse':
        case undefined: {
            console.log('\n📚 Decision Pack Marketplace\n');
            const packs = await getMarketplaceIndex();

            for (const pack of packs) {
                console.log(`📦 ${pack.name} (${pack.id})`);
                console.log(`   ${pack.description}`);
                console.log(`   Scope: ${pack.scope} | ${pack.decisionCount} decisions | ⬇ ${pack.downloads}`);
                console.log('');
            }
            console.log('Install: decide marketplace install <pack-id>');
            break;
        }

        case 'search': {
            const query = args[2];
            if (!query) {
                console.log('Usage: decide marketplace search <query>');
                return;
            }

            console.log(`\n🔍 Searching for "${query}"...\n`);
            const results = await searchMarketplace(query);

            if (results.length === 0) {
                console.log('No packs found.');
                return;
            }

            for (const pack of results) {
                console.log(`📦 ${pack.name} (${pack.id})`);
                console.log(`   ${pack.description}`);
                console.log('');
            }
            break;
        }

        case 'install': {
            const packId = args[2];
            if (!packId) {
                console.log('Usage: decide marketplace install <pack-id>');
                return;
            }

            console.log(`\n📥 Installing ${packId}...\n`);

            try {
                const result = await installPack(packId);
                console.log(`✅ Installed ${result.installed} decisions`);
                if (result.skipped > 0) {
                    console.log(`⚠️  Skipped ${result.skipped} duplicates`);
                }
                console.log('\nPre-embedded vectors included - no sync needed!');
            } catch (error) {
                console.log(`❌ ${(error as Error).message}`);
            }
            break;
        }

        default:
            console.log('Usage: decide marketplace [browse|search|install]');
    }
}

async function handleProjects() {
    console.log(`\n  ${c.bold}${c.white}Projects${c.reset}\n`);

    const globalDecisions = await listGlobalDecisions();
    if (globalDecisions.length > 0) {
        const globalScopes = await getGlobalScopes();
        console.log(`  ${c.yellow}● Global${c.reset}  ${c.dim}${globalDecisions.length} decisions${c.reset}  ${c.dim}[${globalScopes.join(', ')}]${c.reset}`);
    }

    const projects = await listProjects();

    if (projects.length === 0 && globalDecisions.length === 0) {
        console.log(`  ${c.dim}No projects found.${c.reset}`);
        console.log(`  Run: ${c.cyan}decide add${c.reset}\n`);
        return;
    }

    for (const project of projects) {
        const scopeStr = project.scopes.length > 0 ? `${c.dim}[${project.scopes.join(', ')}]${c.reset}` : '';
        console.log(`  ${c.cyan}■${c.reset} ${c.bold}${project.name}${c.reset}  ${c.dim}${project.decisionCount} decisions${c.reset}  ${scopeStr}`);
    }

    console.log(`\n  ${c.dim}${projects.length} projects${globalDecisions.length > 0 ? ` + global (${globalDecisions.length})` : ''}${c.reset}\n`);
}

/**
 * Handle login command - authenticate with DecisionNode
 */
async function handleLogin(): Promise<void> {
    const status = await getCloudStatus();

    if (status.authenticated) {
        console.log(`\n✅ Already logged in as ${status.username || status.email || 'Unknown'}`);
        console.log(`   Subscription: ${status.isPro ? '⭐ Pro' : 'Free'}`);
        console.log('\n   Run "decide logout" to sign out first.\n');
        return;
    }

    await loginToCloud();
}

/**
 * Handle logout command - sign out from DecisionNode
 */
async function handleLogout(): Promise<void> {
    await logoutFromCloud();
}

/**
 * Handle status command - show account and subscription status
 */
async function handleStatus(): Promise<void> {
    const status = await getCloudStatus();

    console.log('\n📊 DecisionNode Status\n');
    console.log('━'.repeat(40));

    if (!status.authenticated) {
        console.log('\n  ❌ Not logged in');
        console.log('\n  Run "decide login" to authenticate.\n');
        return;
    }

    console.log(`\n  👤 Account: ${status.username || status.email || 'Unknown'}`);
    console.log(`  🆔 User ID: ${status.userId || 'Unknown'}`);

    if (status.isPro) {
        console.log(`  ⭐ Subscription: Pro`);
        if (status.expiresAt) {
            const expiresDate = new Date(status.expiresAt);
            const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            console.log(`  📅 Expires: ${expiresDate.toLocaleDateString()} (${daysLeft} days)`);
        }
    } else {
        console.log(`  📦 Subscription: Free`);
        console.log(`\n  💡 Upgrade to Pro for cloud sync and embedding:`);
        console.log(`     https://decisionnode.dev/pricing`);
    }

    if (status.lastSync) {
        console.log(`\n  ☁️  Last sync: ${new Date(status.lastSync).toLocaleString()}`);
    }

    console.log('');
}

/**
 * Handle sync command - intelligent two-way sync (Pro only)
 */
async function handleSync(): Promise<void> {
    const status = await getCloudStatus();

    if (!status.authenticated) {
        console.log('\n❌ Not logged in. Run "decide login" first.\n');
        return;
    }

    if (!status.isPro) {
        console.log('\n❌ Cloud sync requires a Pro subscription.');
        console.log('\n   Upgrade at: https://decisionnode.dev/pricing\n');
        return;
    }

    const pushOnly = args.includes('--push-only');
    const pullOnly = args.includes('--pull-only');

    const cwd = process.cwd();
    const projectName = path.basename(cwd);
    const projectRoot = getProjectRoot();

    console.log(`\n☁️  Syncing decisions...`);
    console.log(`   Project: ${projectName}\n`);

    // Get local and cloud decisions
    const localDecisions = await listDecisions();
    const cloudDecisions = await pullDecisionsFromCloud(projectName) as CloudDecision[] | null;

    if (!cloudDecisions && !pushOnly) {
        console.log('❌ Failed to fetch cloud decisions.\n');
        return;
    }

    // Detect what needs to be done
    const { toPush, toPull, conflicts } = await detectConflicts(
        projectRoot,
        localDecisions.map(d => ({ id: d.id, decision: d.decision, updatedAt: d.updatedAt, scope: d.scope })),
        cloudDecisions || []
    );

    // Report conflicts
    if (conflicts.length > 0) {
        console.log(`⚠️  ${conflicts.length} conflict(s) detected!`);
        console.log('   Run "decide conflicts" to resolve them.\n');
    }

    // Push local changes
    if (!pullOnly && toPush.length > 0) {
        console.log(`⬆️  Pushing ${toPush.length} decision(s)...`);

        // Attach embeddings if available
        const { loadVectorCache } = await import('./ai/rag.js');
        const vectorCache = await loadVectorCache();

        const decisionsToSync = localDecisions
            .filter(d => toPush.includes(d.id))
            .map(d => {
                const entry = vectorCache[d.id];
                const vector = entry ? (Array.isArray(entry) ? entry : entry.vector) : undefined;
                return {
                    ...d,
                    embedding: vector
                };
            });

        const result = await syncDecisionsToCloud(projectName, decisionsToSync);

        if (result) {
            console.log(`   ✅ Pushed: ${result.synced.length}`);
            console.log(`   📊 Embedded: ${result.embedded}`);
            if (result.failed.length > 0) {
                console.log(`   ❌ Failed: ${result.failed.join(', ')}`);
            }

            // Update sync metadata
            await updateSyncMetadata(projectRoot, result.synced, cloudDecisions || []);

            // Log push to history
            if (result.synced.length > 0) {
                await logBatchAction('cloud_push', result.synced, 'cloud');
            }
        }
    } else if (!pullOnly) {
        console.log('⬆️  No local changes to push.');
    }

    // Pull cloud changes
    if (!pushOnly && toPull.length > 0) {
        console.log(`\n⬇️  Pulling ${toPull.length} decision(s) from cloud...`);

        // Group by scope and save
        const updatesByScope: Record<string, DecisionNode[]> = {};
        for (const cloud of toPull) {
            // Skip metadata scope
            if (cloud.scope === 'Sync-metadata') continue;

            const node: DecisionNode = {
                id: cloud.decision_id,
                scope: cloud.scope,
                decision: cloud.decision,
                rationale: cloud.rationale || undefined,
                constraints: cloud.constraints || undefined,
                status: (cloud.status === 'active' || cloud.status === 'deprecated') ? cloud.status : 'active',
                tags: (cloud as any).tags || undefined,
                createdAt: (cloud as any).created_at || new Date().toISOString(),
                updatedAt: cloud.synced_at || undefined,
            };
            if (!updatesByScope[cloud.scope]) updatesByScope[cloud.scope] = [];
            updatesByScope[cloud.scope].push(node);
        }

        // Safe Merge Logic
        for (const [scope, newNodes] of Object.entries(updatesByScope)) {
            // Get CURRENT local items for this scope
            const currentScopeItems = localDecisions.filter(d => d.scope === scope);

            // Merge: Start with existing, map updates over them
            const mergedItems = [...currentScopeItems];

            for (const newNode of newNodes) {
                const index = mergedItems.findIndex(m => m.id === newNode.id);
                if (index >= 0) {
                    // Update existing
                    mergedItems[index] = newNode;
                } else {
                    // Add new
                    mergedItems.push(newNode);
                }
            }

            // Save matched scope
            await saveDecisions({ scope, decisions: mergedItems });

            // Save vectors from cloud directly - NO local generation fallback
            const { loadVectorCache, saveVectorCache } = await import('./ai/rag.js');
            const vectorCache = await loadVectorCache();
            let vectorsUpdated = false;

            for (const newNode of newNodes) {
                const cloudMatch = toPull.find(c => c.decision_id === newNode.id || c.id === newNode.id);

                if (cloudMatch && cloudMatch.embedding) {
                    // Option A: Use Cloud Vector
                    let vector: number[] | null = null;

                    if (typeof cloudMatch.embedding === 'string') {
                        try {
                            vector = JSON.parse(cloudMatch.embedding);
                        } catch {
                            vector = null;
                        }
                    } else if (Array.isArray(cloudMatch.embedding)) {
                        vector = cloudMatch.embedding;
                    }

                    if (vector && Array.isArray(vector)) {
                        vectorCache[newNode.id] = {
                            vector: vector,
                            embeddedAt: new Date().toISOString()
                        };
                        vectorsUpdated = true;
                    }
                }
            }

            if (vectorsUpdated) {
                await saveVectorCache(vectorCache);
            }

            console.log(`   ✅ Pulled: ${scope} (${newNodes.length} updates)`);
        }

        // Update sync metadata for pulled decisions
        const pulledIds = toPull.map(d => d.decision_id);
        await updateSyncMetadata(projectRoot, pulledIds, toPull);

        // Clear pulled items from incoming changes
        await removeIncomingChanges(projectRoot, pulledIds);

        // Log pull to history
        if (pulledIds.length > 0) {
            await logBatchAction('cloud_pull', pulledIds, 'cloud');
        }
    } else if (!pushOnly) {
        console.log('\n⬇️  No cloud-only changes to pull.');
    }

    // Self-Heal: If no changes were made but decisions exist on both sides, 
    // ensure metadata is up to date (fixes missing sync-metadata.json case).
    if (toPush.length === 0 && toPull.length === 0 && conflicts.length === 0) {
        if (localDecisions.length > 0 && cloudDecisions && cloudDecisions.length > 0) {
            // Find intersection
            const cloudIds = new Set(cloudDecisions.map(d => d.decision_id));
            const inSyncIds = localDecisions
                .filter(d => cloudIds.has(d.id))
                .map(d => d.id);

            if (inSyncIds.length > 0) {
                // Determine if metadata file exists or needs update
                // For simplicity, we just update it. It's cheap.
                await updateSyncMetadata(projectRoot, inSyncIds, cloudDecisions);
                // console.log('   🔄 Verified sync metadata.'); // Optional logging
            }
        }
    }

    console.log('\n🎉 Sync complete!\n');
}

/**
 * Handle cloud command - show cloud sync status
 */
async function handleCloud(): Promise<void> {
    const subCommand = args[1];

    if (subCommand === 'status') {
        await handleCloudSyncStatus();
        return;
    }

    // Default: show help
    console.log(`
☁️  DecisionNode Cloud

Commands:
  decide cloud status   Show sync status for current project

Related commands:
  decide login          Log in to your DecisionNode account
  decide logout         Log out
  decide status         Show account status
  decide sync           Sync decisions to cloud (Pro only)
`);
}

/**
 * Handle cloud status - show which decisions are synced
 */
async function handleCloudSyncStatus(): Promise<void> {
    const status = await getCloudStatus();

    if (!status.authenticated) {
        console.log('\n❌ Not logged in. Run "decide login" first.\n');
        return;
    }

    if (!status.isPro) {
        console.log('\n❌ Cloud sync requires a Pro subscription.');
        console.log('\n   Upgrade at: https://decisionnode.dev/pricing\n');
        return;
    }

    const cwd = process.cwd();
    const projectName = path.basename(cwd);

    console.log(`\n☁️  Cloud Sync Status: ${projectName}\n`);
    console.log('━'.repeat(40));

    // Get local decisions
    const localDecisions = await listDecisions();

    // Get synced decisions from cloud
    const cloudStatus = await getCloudSyncStatus(projectName);

    if (!cloudStatus) {
        console.log('\n  Unable to fetch cloud status.\n');
        return;
    }

    const syncedIds = new Set(cloudStatus.synced);
    const notSynced: string[] = [];

    for (const decision of localDecisions) {
        if (!syncedIds.has(decision.id)) {
            notSynced.push(decision.id);
        }
    }

    console.log(`\n  📁 Local decisions: ${localDecisions.length}`);
    console.log(`  ☁️  In cloud: ${cloudStatus.total_in_cloud}`);

    if (notSynced.length === 0) {
        console.log(`\n  ✅ All decisions are synced!\n`);
    } else {
        console.log(`\n  ⚠️  Not synced (${notSynced.length}):`);
        for (const id of notSynced.slice(0, 10)) {
            console.log(`     - ${id}`);
        }
        if (notSynced.length > 10) {
            console.log(`     ... and ${notSynced.length - 10} more`);
        }
        console.log(`\n  Run "decide sync" to sync all decisions.\n`);
    }
}

/**
 * Handle pull command - pull decisions from cloud
 */
async function handlePull(): Promise<void> {
    console.log('\n☁️  Pulling decisions from cloud...\n');

    const cwd = process.cwd();
    const projectName = path.basename(cwd);
    const projectRoot = getProjectRoot();

    // 1. Get local decisions
    const localDecisions = await listDecisions();

    // 2. Get cloud decisions
    const cloudDecisions = await pullDecisionsFromCloud(projectName) as CloudDecision[] | null;

    if (!cloudDecisions) {
        console.log('❌ Failed to pull decisions.');
        console.log('   Check if you are logged in (decide login) and have a Pro subscription.');
        return;
    }

    if (cloudDecisions.length === 0) {
        console.log('✅ No decisions found in cloud for this project.');
        return;
    }

    console.log(`Cloud has ${cloudDecisions.length} decisions.`);
    console.log('🔍 Checking for conflicts...');

    // 3. Detect conflicts
    const { conflicts, toPull } = await detectConflicts(
        projectRoot,
        localDecisions.map(d => ({ id: d.id, decision: d.decision, updatedAt: d.updatedAt, scope: d.scope })),
        cloudDecisions
    );

    // 4. Handle Conflicts
    if (conflicts.length > 0) {
        console.log(`\n❌ Aborting pull: ${conflicts.length} conflict(s) detected.`);
        console.log('   These decisions have changed both locally and in the cloud:');
        conflicts.slice(0, 3).forEach(c => console.log(`   - ${c.decisionId} (${c.scope})`));
        if (conflicts.length > 3) console.log(`   ...and ${conflicts.length - 3} more.`);
        console.log('\n👉 Run "decide conflicts" to examine and resolve them safely.');
        return;
    }

    // 5. Check if anything to pull
    if (toPull.length === 0) {
        console.log('\n✅ Local decisions are already up to date with cloud.');
        return;
    }

    console.log(`\n⬇️  Pulling ${toPull.length} new/updated decision(s) from cloud...`);

    // 6. Merge & Save (Safe Update)
    const updatesByScope: Record<string, DecisionNode[]> = {};

    // Group toPull items by scope
    for (const d of toPull) {
        // Skip metadata scope if it accidentally got synced
        if (d.scope === 'Sync-metadata') continue;

        const node: DecisionNode = {
            id: d.decision_id || d.id,
            scope: d.scope,
            decision: d.decision,
            rationale: d.rationale || undefined,
            constraints: d.constraints || undefined,
            status: (d.status === 'active' || d.status === 'deprecated') ? d.status : 'active',
            tags: (d as any).tags || undefined,
            createdAt: (d as any).created_at || new Date().toISOString(),
            updatedAt: d.synced_at || undefined,
        };

        if (!updatesByScope[node.scope]) {
            updatesByScope[node.scope] = [];
        }
        updatesByScope[node.scope].push(node);
    }

    let savedCount = 0;

    // Apply updates scope by scope
    for (const [scope, newNodes] of Object.entries(updatesByScope)) {
        // Get CURRENT local items for this scope
        const currentScopeItems = localDecisions.filter(d => d.scope === scope);

        // Merge: Start with existing, map updates over them
        const mergedItems = [...currentScopeItems];

        for (const newNode of newNodes) {
            const index = mergedItems.findIndex(m => m.id === newNode.id);
            if (index >= 0) {
                // Update existing
                mergedItems[index] = newNode;
            } else {
                // Add new
                mergedItems.push(newNode);
            }
        }

        // Save matched scope
        await saveDecisions({
            scope: scope,
            decisions: mergedItems
        });

        // Save vectors from cloud directly, OR fallback to local embedding
        const { loadVectorCache, saveVectorCache, embedDecisions } = await import('./ai/rag.js');
        const vectorCache = await loadVectorCache();
        let vectorsUpdated = false;
        const nodesToAutoEmbed: DecisionNode[] = [];

        for (const newNode of newNodes) {
            const cloudMatch = toPull.find(c => c.decision_id === newNode.id || c.id === newNode.id);

            if (cloudMatch && cloudMatch.embedding) {
                // Option A: Use Cloud Vector
                let vector: number[] | null = null;

                if (typeof cloudMatch.embedding === 'string') {
                    try {
                        vector = JSON.parse(cloudMatch.embedding);
                    } catch {
                        vector = null;
                    }
                } else if (Array.isArray(cloudMatch.embedding)) {
                    vector = cloudMatch.embedding;
                }

                if (vector && Array.isArray(vector)) {
                    vectorCache[newNode.id] = {
                        vector: vector,
                        embeddedAt: new Date().toISOString()
                    };
                    vectorsUpdated = true;
                } else {
                    // Invalid vector format - fallback
                    nodesToAutoEmbed.push(newNode);
                }
            } else {
                // Option B: Cloud has no vector? Fallback to local gen
                nodesToAutoEmbed.push(newNode);
            }
        }

        if (vectorsUpdated) {
            await saveVectorCache(vectorCache);
        }

        // Fallback: Embed any nodes that didn't have cloud vectors
        if (nodesToAutoEmbed.length > 0) {
            console.log(`   ⚠️  ${nodesToAutoEmbed.length} decisions missing cloud vectors. Generating locally...`);
            await embedDecisions(nodesToAutoEmbed);
        }

        savedCount += newNodes.length;
        console.log(`   ✅ Updated ${scope} (+${newNodes.length} changes)`);
    }

    // Also handle scopes that are NEW (no local file yet)
    // The previous loop only handles updates where 'updatesByScope' has keys.

    // 7. Update Sync Metadata
    // This ensures VS Code and CLI know these files are now in sync
    await updateSyncMetadata(
        projectRoot,
        toPull.map(d => d.decision_id),
        cloudDecisions
    );

    // 8. Clear pulled items from incoming changes (fetch state)
    const { removeIncomingChanges } = await import('./cloud.js');
    await removeIncomingChanges(projectRoot, toPull.map(d => d.decision_id));

    console.log(`\n🎉 Pull complete. Updated ${savedCount} decisions.`);
}

/**
 * Handle conflicts command - list and resolve sync conflicts
 * Usage: decide conflicts [resolve <id> <local|cloud>]
 */
async function handleConflicts(): Promise<void> {
    const subCommand = args[1];
    const projectRoot = getProjectRoot();

    // Handle non-interactive 'resolve' subcommand (for VS Code integration)
    if (subCommand === 'resolve') {
        const decisionId = args[2];
        const resolution = args[3] as 'local' | 'cloud';

        if (!decisionId || !resolution) {
            console.error('❌ Usage: decide conflicts resolve <decision-id> <local|cloud>');
            process.exit(1);
        }

        if (resolution !== 'local' && resolution !== 'cloud') {
            console.error('❌ Resolution must be "local" or "cloud"');
            process.exit(1);
        }

        // Load incoming.json to get conflicts
        const incomingPath = path.join(projectRoot, 'incoming.json');
        let data: { conflicts?: SyncConflict[] } = { conflicts: [] };

        try {
            const content = await fs.readFile(incomingPath, 'utf-8');
            data = JSON.parse(content);
        } catch {
            // No incoming file
        }

        const conflicts = data.conflicts || [];
        const conflict = conflicts.find(c => c.decisionId === decisionId);

        if (!conflict) {
            console.error(`❌ No conflict found for decision: ${decisionId}`);
            process.exit(1);
        }

        // If cloud wins, update local decision
        if (resolution === 'cloud') {
            const updated = await updateDecision(decisionId, {
                decision: conflict.cloudDecision,
                updatedAt: new Date().toISOString()
            });
            if (!updated) {
                console.error(`❌ Failed to update local decision: ${decisionId}`);
                process.exit(1);
            }
        }

        // Resolve conflict in metadata
        await resolveConflict(
            projectRoot,
            decisionId,
            resolution,
            resolution === 'cloud' ? {
                id: '',
                user_id: '',
                project_name: '',
                decision_id: decisionId,
                scope: conflict.scope,
                decision: conflict.cloudDecision,
                rationale: null,
                constraints: null,
                status: 'active',
                synced_at: new Date().toISOString(),
                updated_at: conflict.cloudUpdatedAt
            } as CloudDecision : undefined
        );

        // Remove conflict from incoming.json
        await removeIncomingChanges(projectRoot, [decisionId]);

        // If local wins, push to cloud to make it the source of truth
        if (resolution === 'local') {
            const decision = await getDecisionById(decisionId);
            if (decision) {
                const projectName = path.basename(projectRoot);
                console.log('   ⬆️  Pushing local version to cloud...');
                await syncDecisionsToCloud(projectName, [decision]);
            }
        }

        console.log(`\n✅ Conflict resolved: ${decisionId}`);
        console.log(`   Accepted: ${resolution} version\n`);

        // Log conflict resolution to history
        await logAction('conflict_resolved', decisionId, `Conflict resolved: accepted ${resolution} (${decisionId})`, 'cloud');
        return;
    }

    // Default: Interactive conflict resolution
    const status = await getCloudStatus();

    if (!status.authenticated) {
        console.log('\n❌ Not logged in. Run "decide login" first.\n');
        return;
    }

    if (!status.isPro) {
        console.log('\n❌ Cloud sync requires a Pro subscription.');
        console.log('\n   Upgrade at: https://decisionnode.dev/pricing\n');
        return;
    }

    const cwd = process.cwd();
    const projectName = path.basename(cwd);

    console.log('\n⚠️  Checking for conflicts...\n');

    // Get local and cloud decisions
    const localDecisions = await listDecisions();
    const cloudDecisions = await pullDecisionsFromCloud(projectName) as CloudDecision[] | null;

    if (!cloudDecisions) {
        console.log('❌ Failed to fetch cloud decisions.');
        return;
    }

    // Detect conflicts
    const { conflicts } = await detectConflicts(
        projectRoot,
        localDecisions.map(d => ({ id: d.id, decision: d.decision, updatedAt: d.updatedAt, scope: d.scope })),
        cloudDecisions
    );

    if (conflicts.length === 0) {
        console.log('✅ No conflicts found! Everything is in sync.\n');
        return;
    }

    console.log(`Found ${conflicts.length} conflict(s):\n`);
    console.log('━'.repeat(60));

    for (let i = 0; i < conflicts.length; i++) {
        const conflict = conflicts[i];
        const cloudDecision = cloudDecisions.find(d => d.decision_id === conflict.decisionId);

        console.log(`\n${i + 1}. ${conflict.decisionId} (${conflict.scope})`);
        console.log('─'.repeat(40));
        console.log(`   📁 Local:  "${conflict.localDecision.substring(0, 50)}${conflict.localDecision.length > 50 ? '...' : ''}"`);
        console.log(`      Updated: ${conflict.localUpdatedAt ? new Date(conflict.localUpdatedAt).toLocaleString() : 'Unknown'}`);
        console.log(`   ☁️  Cloud:  "${conflict.cloudDecision.substring(0, 50)}${conflict.cloudDecision.length > 50 ? '...' : ''}"`);
        console.log(`      Updated: ${new Date(conflict.cloudUpdatedAt).toLocaleString()}`);

        const choice = await prompt('\n   [L]ocal or [C]loud? ');
        const resolution = choice.toLowerCase().startsWith('l') ? 'local' : 'cloud';

        if (resolution === 'local') {
            // Keep local version - mark for push
            await resolveConflict(projectRoot, conflict.decisionId, 'local');
            console.log('   ✅ Keeping local version (will push on next sync)');
        } else {
            // Use cloud version - update local
            if (cloudDecision) {
                await resolveConflict(projectRoot, conflict.decisionId, 'cloud', cloudDecision);
                // Update local decision with cloud data
                await updateDecision(conflict.decisionId, {
                    decision: cloudDecision.decision,
                    rationale: cloudDecision.rationale || undefined,
                    constraints: cloudDecision.constraints || undefined,
                    status: cloudDecision.status as 'active' | 'deprecated',
                });
                console.log('   ✅ Updated to cloud version');
            }
        }
    }

    console.log('\n🎉 All conflicts resolved!\n');
}

/**
 * Handle fetch command - check for cloud updates without applying them
 */
async function handleFetch(): Promise<void> {
    const status = await getCloudStatus();

    if (!status.authenticated) {
        console.log('\n❌ Not logged in. Run "decide login" first.\n');
        return;
    }

    if (!status.isPro) {
        console.log('\n❌ Cloud sync requires a Pro subscription.');
        console.log('\n   Upgrade at: https://decisionnode.dev/pricing\n');
        return;
    }

    console.log('\n🔍 Fetching updates from cloud... (no changes will be applied)\n');

    const cwd = process.cwd();
    const projectName = path.basename(cwd);
    const projectRoot = getProjectRoot();

    // 1. Get local decisions
    const localDecisions = await listDecisions();

    // 2. Get cloud decisions
    const cloudDecisions = await pullDecisionsFromCloud(projectName) as CloudDecision[] | null;

    if (!cloudDecisions) {
        console.log('❌ Failed to fetch cloud decisions.');
        return;
    }

    // 3. Detect conflicts/updates
    const { toPull, conflicts } = await detectConflicts(
        projectRoot,
        localDecisions.map(d => ({ id: d.id, decision: d.decision, updatedAt: d.updatedAt, scope: d.scope })),
        cloudDecisions
    );

    // 4. Save results to incoming.json
    await saveIncomingChanges(projectRoot, { toPull, conflicts });

    // 5. Report status
    if (toPull.length === 0 && conflicts.length === 0) {
        console.log('✅ Local decisions are up to date.');
    } else {
        if (toPull.length > 0) {
            console.log(`⬇️  ${toPull.length} incoming change(s) available.`);
            toPull.slice(0, 3).forEach(d => console.log(`   - ${d.decision_id} (${d.scope})`));
            if (toPull.length > 3) console.log(`     ...and ${toPull.length - 3} more`);
        }

        if (conflicts.length > 0) {
            console.log(`\n⚠️  ${conflicts.length} conflict(s) detected.`);
        }

        console.log('\n👉 Run "decide sync --pull-only" to apply changes.');
    }
}

interface UiDaemonState {
    pid: number;
    port: number;
    url: string;
    startedAt: string;
}

function getUiStateFile(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, '.decisionnode', '.ui-daemon.json');
}

async function readUiDaemonState(): Promise<UiDaemonState | null> {
    try {
        const content = await fs.readFile(getUiStateFile(), 'utf-8');
        return JSON.parse(content) as UiDaemonState;
    } catch {
        return null;
    }
}

function isPidAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function writeUiDaemonState(state: UiDaemonState): Promise<void> {
    const file = getUiStateFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(state, null, 2), 'utf-8');
}

async function clearUiDaemonState(): Promise<void> {
    try {
        await fs.unlink(getUiStateFile());
    } catch {
        // Ignore
    }
}

async function openBrowser(url: string): Promise<void> {
    const { spawn } = await import('node:child_process');
    const opener =
        process.platform === 'win32' ? 'start' :
        process.platform === 'darwin' ? 'open' : 'xdg-open';
    try {
        spawn(opener, [url], {
            detached: true,
            stdio: 'ignore',
            shell: process.platform === 'win32',
        }).unref();
    } catch {
        // Ignore — URL is printed for manual copy
    }
}

async function handleUi() {
    // Parse flags
    let port: number | undefined;
    let noOpen = false;
    let detach = false;
    let stop = false;
    let status = false;
    let internalDaemon = false;
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--no-open') {
            noOpen = true;
        } else if (arg === '-d' || arg === '--detach') {
            detach = true;
        } else if (arg === 'stop' || arg === '--stop') {
            stop = true;
        } else if (arg === 'status' || arg === '--status') {
            status = true;
        } else if (arg === '--background') {
            // Internal flag used when spawned by --detach
            internalDaemon = true;
        } else if (arg === '--port' && args[i + 1]) {
            const parsed = Number.parseInt(args[i + 1], 10);
            if (!Number.isNaN(parsed)) port = parsed;
            i++;
        }
    }

    // ─── stop: kill the running daemon ─────────────────
    if (stop) {
        const state = await readUiDaemonState();
        if (!state) {
            console.log(`\n  ${c.dim}No UI server running.${c.reset}\n`);
            return;
        }
        if (!isPidAlive(state.pid)) {
            await clearUiDaemonState();
            console.log(`\n  ${c.dim}No UI server running (stale state cleared).${c.reset}\n`);
            return;
        }
        try {
            process.kill(state.pid);
            await clearUiDaemonState();
            console.log(`\n  ${c.green}✓${c.reset} Stopped UI server ${c.dim}(pid ${state.pid}, was at ${state.url})${c.reset}\n`);
        } catch (err) {
            console.error(`\n  ${c.red}✗${c.reset} Failed to stop: ${(err as Error).message}\n`);
            process.exit(1);
        }
        return;
    }

    // ─── status: show current daemon state ────────────
    if (status) {
        const state = await readUiDaemonState();
        if (!state) {
            console.log(`\n  ${c.dim}UI server:${c.reset} not running\n`);
            return;
        }
        if (!isPidAlive(state.pid)) {
            await clearUiDaemonState();
            console.log(`\n  ${c.dim}UI server:${c.reset} not running ${c.dim}(stale state cleared)${c.reset}\n`);
            return;
        }
        const uptimeMs = Date.now() - new Date(state.startedAt).getTime();
        const uptimeMin = Math.floor(uptimeMs / 60000);
        console.log(`\n  ${c.green}✓${c.reset} UI server running`);
        console.log(`    ${c.dim}URL:${c.reset}     ${c.cyan}${state.url}${c.reset}`);
        console.log(`    ${c.dim}PID:${c.reset}     ${state.pid}`);
        console.log(`    ${c.dim}Uptime:${c.reset}  ${uptimeMin}m\n`);
        return;
    }

    // ─── detach: spawn self as background daemon ──────
    if (detach) {
        const existing = await readUiDaemonState();
        if (existing && isPidAlive(existing.pid)) {
            console.log(`\n  ${c.yellow}!${c.reset} UI server already running at ${c.cyan}${existing.url}${c.reset}`);
            console.log(`  ${c.dim}Stop it with:${c.reset} ${c.cyan}decisionnode ui stop${c.reset}\n`);
            return;
        }
        if (existing) {
            // Stale state — clear it
            await clearUiDaemonState();
        }

        banner();
        console.log('');
        console.log(`  ${c.dim}Starting UI server in background…${c.reset}`);

        const { spawn } = await import('node:child_process');
        const childArgs = ['ui', '--background', '--no-open'];
        if (port !== undefined) childArgs.push('--port', String(port));

        const child = spawn(process.execPath, [process.argv[1], ...childArgs], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
        });
        child.unref();

        // Wait for the daemon to write its state file (up to 5s)
        const deadline = Date.now() + 5000;
        let state: UiDaemonState | null = null;
        while (Date.now() < deadline) {
            state = await readUiDaemonState();
            if (state && isPidAlive(state.pid)) break;
            await new Promise((r) => setTimeout(r, 150));
        }

        if (!state) {
            console.error(`\n  ${c.red}✗${c.reset} UI server failed to start within 5s.\n`);
            process.exit(1);
        }

        console.log('');
        console.log(`  ${c.green}✓${c.reset} UI running in background at ${c.cyan}${state.url}${c.reset}`);
        console.log(`  ${c.dim}Stop with:${c.reset} ${c.cyan}decisionnode ui stop${c.reset}`);
        console.log(`  ${c.dim}Status with:${c.reset} ${c.cyan}decisionnode ui status${c.reset}\n`);

        if (!noOpen) {
            await openBrowser(state.url);
        }
        return;
    }

    // ─── foreground (or internal background daemon) ───
    // Check if one is already running; refuse to start a second one
    const existing = await readUiDaemonState();
    if (existing && isPidAlive(existing.pid)) {
        if (!internalDaemon) {
            banner();
            console.log('');
            console.log(`  ${c.yellow}!${c.reset} UI server already running at ${c.cyan}${existing.url}${c.reset}`);
            console.log(`  ${c.dim}Stop it first with:${c.reset} ${c.cyan}decisionnode ui stop${c.reset}\n`);
            return;
        }
        // If we're the detached child and state already exists with a live PID,
        // something is odd — exit quietly so we don't double-run
        process.exit(1);
    }

    const { startUiServer } = await import('./ui/server.js');

    if (!internalDaemon) {
        banner();
        console.log('');
        console.log(`  ${c.dim}Starting UI server…${c.reset}`);
    }

    let handle;
    try {
        handle = await startUiServer({ port });
    } catch (err) {
        if (!internalDaemon) {
            console.error(`\n  ${c.red}✗${c.reset} Failed to start UI server: ${(err as Error).message}\n`);
        }
        process.exit(1);
    }

    // Record the running daemon state — used by --stop/--status/--detach
    const portMatch = handle.url.match(/:(\d+)$/);
    const actualPort = portMatch ? Number.parseInt(portMatch[1], 10) : 0;
    await writeUiDaemonState({
        pid: process.pid,
        port: actualPort,
        url: handle.url,
        startedAt: new Date().toISOString(),
    });

    if (!internalDaemon) {
        console.log('');
        console.log(`  ${c.green}✓${c.reset} UI ready at ${c.cyan}${handle.url}${c.reset}`);
        console.log(`  ${c.dim}Press Ctrl+C to stop${c.reset}\n`);

        if (!noOpen) {
            await openBrowser(handle.url);
        }
    }

    const shutdown = async () => {
        if (!internalDaemon) {
            console.log(`\n  ${c.dim}Shutting down…${c.reset}`);
        }
        try {
            await handle.close();
        } catch {
            // Ignore
        }
        await clearUiDaemonState();
        process.exit(0);
    };

    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());

    // Keep process alive
    await new Promise(() => {});
}

function printUsage() {
    banner();
    console.log('');
    console.log(`  ${c.dim}Usage:${c.reset} ${c.cyan}decide${c.reset} ${c.white}<command>${c.reset} ${c.dim}[options]${c.reset}`);
    console.log('');
    console.log(`  ${c.bold}${c.white}Getting Started${c.reset}`);
    console.log(`    ${c.cyan}init${c.reset}                  ${c.dim}Initialize DecisionNode in current project${c.reset}`);
    console.log(`    ${c.cyan}setup${c.reset}                 ${c.dim}Configure Gemini API key${c.reset}`);
    console.log('');
    console.log(`  ${c.bold}${c.white}Decisions${c.reset}`);
    console.log(`    ${c.cyan}add${c.reset}                   ${c.dim}Add a new decision (interactive or inline)${c.reset}`);
    console.log(`    ${c.cyan}list${c.reset}                  ${c.dim}List all decisions (includes global)${c.reset}`);
    console.log(`    ${c.cyan}get${c.reset} ${c.gray}<id>${c.reset}              ${c.dim}View a decision${c.reset}`);
    console.log(`    ${c.cyan}search${c.reset} ${c.gray}"query"${c.reset}        ${c.dim}Semantic search${c.reset}`);
    console.log(`    ${c.cyan}edit${c.reset} ${c.gray}<id>${c.reset} ${c.gray}[-f]${c.reset}          ${c.dim}Edit a decision (use -f to skip global confirmation)${c.reset}`);
    console.log(`    ${c.cyan}deprecate${c.reset} ${c.gray}<id>${c.reset}        ${c.dim}Hide from search (reversible)${c.reset}`);
    console.log(`    ${c.cyan}activate${c.reset} ${c.gray}<id>${c.reset}         ${c.dim}Re-activate a deprecated decision${c.reset}`);
    console.log(`    ${c.cyan}delete${c.reset} ${c.gray}<id>${c.reset} ${c.gray}[-f]${c.reset}        ${c.dim}Permanently delete (use -f to skip confirmation)${c.reset}`);
    console.log(`    ${c.cyan}delete-scope${c.reset} ${c.gray}<scope>${c.reset} ${c.gray}[-f]${c.reset} ${c.dim}Delete entire scope (use -f to skip confirmation)${c.reset}`);
    console.log('');
    console.log(`  ${c.bold}${c.white}Data${c.reset}`);
    console.log(`    ${c.cyan}export${c.reset} ${c.gray}[format]${c.reset}       ${c.dim}Export (md, json, csv)${c.reset}`);
    console.log(`    ${c.cyan}import${c.reset} ${c.gray}<file>${c.reset}         ${c.dim}Import from JSON${c.reset}`);
    console.log(`    ${c.cyan}check${c.reset}                 ${c.dim}Show unembedded decisions${c.reset}`);
    console.log(`    ${c.cyan}embed${c.reset}                 ${c.dim}Embed any unembedded decisions${c.reset}`);
    console.log(`    ${c.cyan}history${c.reset}               ${c.dim}View activity log${c.reset}`);
    console.log(`    ${c.cyan}projects${c.reset}              ${c.dim}List all projects${c.reset}`);
    console.log(`    ${c.cyan}config${c.reset}                ${c.dim}View/set configuration${c.reset}`);
    console.log('');
    console.log(`  ${c.bold}${c.white}Visualization${c.reset}`);
    console.log(`    ${c.cyan}ui${c.reset} ${c.gray}[--port N] [--no-open]${c.reset}      ${c.dim}Launch local web UI (graph + vector space)${c.reset}`);
    console.log(`    ${c.cyan}ui${c.reset} ${c.gray}-d${c.reset}                         ${c.dim}Run the UI in the background (detach from terminal)${c.reset}`);
    console.log(`    ${c.cyan}ui stop${c.reset}                       ${c.dim}Stop a background UI server${c.reset}`);
    console.log(`    ${c.cyan}ui status${c.reset}                     ${c.dim}Show whether the UI server is running${c.reset}`);
    console.log('');
    console.log(`  ${c.dim}Global decisions use the ${c.reset}${c.yellow}global:${c.reset}${c.dim} prefix (e.g., ${c.reset}${c.yellow}global:ui-001${c.reset}${c.dim})${c.reset}`);
    console.log(`  ${c.dim}Docs: ${c.cyan}https://decisionnode.dev/docs${c.reset}`);
    console.log('');
}

/**
 * Handle config command - view or set configuration options
 */
async function handleConfig(): Promise<void> {
    const subCommand = args[1];
    const value = args[2];

    if (!subCommand) {
        const behavior = getAgentBehavior();
        const threshold = getSearchThreshold();
        console.log(`\n  ${c.bold}${c.white}Configuration${c.reset}\n`);
        console.log(`  ${c.dim}agent-behavior${c.reset}      ${c.cyan}${behavior}${c.reset}`);
        console.log(`  ${c.dim}search-threshold${c.reset}    ${c.cyan}${threshold}${c.reset}`);
        console.log(`\n  ${c.dim}Usage:${c.reset} ${c.cyan}decide config${c.reset} ${c.gray}<option> <value>${c.reset}\n`);
        return;
    }

    if (subCommand === 'agent-behavior') {
        if (!value) {
            const current = getAgentBehavior();
            console.log(`\n  ${c.dim}agent-behavior:${c.reset} ${c.cyan}${current}${c.reset}`);
            console.log(`  ${c.dim}Usage:${c.reset} ${c.cyan}decide config agent-behavior${c.reset} ${c.gray}<strict|relaxed>${c.reset}\n`);
            return;
        }

        if (value !== 'strict' && value !== 'relaxed') {
            console.error(`  ${c.red}✗${c.reset} Invalid value. Use ${c.cyan}strict${c.reset} or ${c.cyan}relaxed${c.reset}\n`);
            process.exit(1);
        }

        setAgentBehavior(value as AgentBehavior);
        console.log(`\n  ${c.green}✓${c.reset} Agent behavior: ${c.cyan}${value}${c.reset}`);

        if (value === 'strict') {
            console.log(`  ${c.dim}AI must search before any code change${c.reset}`);
        } else {
            console.log(`  ${c.dim}AI searches when it thinks it's relevant${c.reset}`);
        }
        console.log(`\n  ${c.dim}Restart your MCP server for changes to take effect.${c.reset}\n`);
        return;
    }

    if (subCommand === 'search-threshold') {
        if (!value) {
            const current = getSearchThreshold();
            console.log(`\n  ${c.dim}search-threshold:${c.reset} ${c.cyan}${current}${c.reset}`);
            console.log(`  ${c.dim}Usage:${c.reset} ${c.cyan}decide config search-threshold${c.reset} ${c.gray}<0.0-1.0>${c.reset}\n`);
            return;
        }

        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 1) {
            console.error(`  ${c.red}✗${c.reset} Invalid value. Must be a number between ${c.cyan}0.0${c.reset} and ${c.cyan}1.0${c.reset}\n`);
            process.exit(1);
        }

        setSearchThreshold(num);
        console.log(`\n  ${c.green}✓${c.reset} Search threshold: ${c.cyan}${num}${c.reset}`);
        console.log(`  ${c.dim}Results below ${(num * 100).toFixed(0)}% similarity will be filtered out${c.reset}\n`);
        return;
    }

    console.error(`  ${c.red}✗${c.reset} Unknown option: ${subCommand}`);
    console.log(`  ${c.dim}Available:${c.reset} agent-behavior, search-threshold\n`);
    process.exit(1);
}

main();
