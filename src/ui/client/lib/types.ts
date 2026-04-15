export interface DecisionConstraint {
    text: string;
}

export interface Decision {
    id: string;
    scope: string;
    decision: string;
    rationale?: string;
    constraints?: string[];
    status: 'active' | 'deprecated';
    createdAt: string;
    updatedAt: string;
    vector: number[] | null;
    isGlobal?: boolean;
}

export interface ProjectInfo {
    name: string;
    decisionCount: number;
    scopes: string[];
    lastModified?: string;
}

export interface HistoryEntry {
    id: string;
    action: string;
    decisionId: string;
    description: string;
    timestamp: string;
    source?: string;
}

export interface AppState {
    currentProject: string | null;
    projects: ProjectInfo[];
    decisions: Decision[];
    globals: Decision[];
    scopes: string[];
    globalScopes: string[];
    history: HistoryEntry[];
    config: {
        searchThreshold: number;
        agentBehavior: string;
    };
}

export interface Edge {
    source: string;
    target: string;
    similarity: number;
}

export interface Point2D {
    id: string;
    x: number;
    y: number;
}
