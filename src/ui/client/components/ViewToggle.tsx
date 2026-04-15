export type ViewMode = 'graph' | 'vector' | 'list';

interface ViewToggleProps {
    view: ViewMode;
    onChange: (view: ViewMode) => void;
    graphStat?: string;
    vectorStat?: string;
    listStat?: string;
}

interface TabDef {
    mode: ViewMode;
    label: string;
    icon: string;
    accentClass: string;
    stat?: string;
}

export function ViewToggle({
    view,
    onChange,
    graphStat,
    vectorStat,
    listStat,
}: ViewToggleProps) {
    const tabs: TabDef[] = [
        {
            mode: 'graph',
            label: 'Graph',
            icon: 'graph',
            accentClass:
                'bg-primary-500/15 text-primary-300 shadow-[0_0_20px_rgba(56,189,248,0.15)] ring-1 ring-primary-500/30',
            stat: graphStat,
        },
        {
            mode: 'vector',
            label: 'Vector Space',
            icon: 'vector',
            accentClass:
                'bg-accent-500/15 text-accent-400 shadow-[0_0_20px_rgba(234,179,8,0.15)] ring-1 ring-accent-500/30',
            stat: vectorStat,
        },
        {
            mode: 'list',
            label: 'List',
            icon: 'list',
            accentClass:
                'bg-violet-500/15 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/30',
            stat: listStat,
        },
    ];

    const renderIcon = (icon: string) => {
        if (icon === 'graph') {
            return (
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
            );
        }
        if (icon === 'vector') {
            return (
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <line x1="12" y1="20" x2="12" y2="10" />
                    <line x1="18" y1="20" x2="18" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="16" />
                </svg>
            );
        }
        // list
        return (
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
        );
    };

    return (
        <div class="absolute left-1/2 top-4 z-20 -translate-x-1/2">
            <div class="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-950/80 p-1 shadow-2xl shadow-black/50 backdrop-blur-md">
                {tabs.map((tab) => {
                    const active = view === tab.mode;
                    return (
                        <button
                            key={tab.mode}
                            onClick={() => onChange(tab.mode)}
                            class={`group flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300 ${
                                active ? tab.accentClass : 'text-zinc-500 hover:text-zinc-200'
                            }`}
                        >
                            {renderIcon(tab.icon)}
                            <span>{tab.label}</span>
                            {tab.stat && (
                                <span
                                    class={`font-mono text-[10px] ${
                                        active ? 'opacity-70' : 'text-zinc-700'
                                    }`}
                                >
                                    {tab.stat}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
