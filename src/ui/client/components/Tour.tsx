import { useState, useEffect } from 'preact/hooks';

const STORAGE_KEY = 'decisionnode-tour-seen';

interface TourStep {
    title: string;
    body: string;
    accent: string;
}

const STEPS: TourStep[] = [
    {
        title: 'Three views, one store',
        body:
            'Switch between Graph, Vector Space, and List with the floating tabs at the top. Same decisions, three perspectives.',
        accent: '#38bdf8',
    },
    {
        title: 'Filter once, see everywhere',
        body:
            'The filter pill below the tabs (text + status) applies to all three views. Type a word, the graph dims unrelated nodes, the list shrinks.',
        accent: '#facc15',
    },
    {
        title: 'Click a node to see details',
        body:
            'Click any decision in the graph, vector space, or list to slide in a side panel with rationale, constraints, and the full activity timeline.',
        accent: '#a78bfa',
    },
    {
        title: 'Watch your AI think',
        body:
            'When Claude Code, Cursor, or any MCP client searches your decisions, the matched nodes pulse in their tool color. Live, in real time.',
        accent: '#34d399',
    },
    {
        title: 'You are ready',
        body:
            'Tip: press / to focus the search bar, Esc to close panels. Run decisionnode ui -d to keep the server running in the background.',
        accent: '#f472b6',
    },
];

export function Tour() {
    const [step, setStep] = useState(0);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            if (!localStorage.getItem(STORAGE_KEY)) {
                setOpen(true);
            }
        } catch {
            // localStorage may be blocked — never show in that case
        }
    }, []);

    const close = () => {
        setOpen(false);
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // ignore
        }
    };

    const next = () => {
        if (step < STEPS.length - 1) {
            setStep(step + 1);
        } else {
            close();
        }
    };

    const prev = () => {
        if (step > 0) setStep(step - 1);
    };

    if (!open) return null;
    const current = STEPS[step];

    return (
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={close}
        >
            <div
                class="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/70 animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top accent bar */}
                <div
                    class="h-1 transition-colors duration-500"
                    style={{ background: current.accent }}
                />

                {/* Body */}
                <div class="px-7 py-7">
                    <div class="mb-3 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                        Welcome · {step + 1} of {STEPS.length}
                    </div>
                    <h2
                        class="mb-3 text-2xl font-bold tracking-tight"
                        style={{ color: current.accent }}
                    >
                        {current.title}
                    </h2>
                    <p class="text-sm leading-relaxed text-zinc-300">{current.body}</p>
                </div>

                {/* Footer */}
                <div class="flex items-center justify-between border-t border-white/5 px-7 py-4">
                    {/* Step dots */}
                    <div class="flex items-center gap-1.5">
                        {STEPS.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => setStep(i)}
                                class="h-1.5 rounded-full transition-all"
                                style={{
                                    width: i === step ? '24px' : '6px',
                                    background: i === step ? s.accent : '#3f3f46',
                                }}
                                aria-label={`Step ${i + 1}`}
                            />
                        ))}
                    </div>

                    <div class="flex items-center gap-2">
                        <button
                            onClick={close}
                            class="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500 transition hover:text-zinc-300"
                        >
                            skip
                        </button>
                        {step > 0 && (
                            <button
                                onClick={prev}
                                class="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
                            >
                                back
                            </button>
                        )}
                        <button
                            onClick={next}
                            class="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-950 transition"
                            style={{
                                background: current.accent,
                                boxShadow: `0 0 18px ${current.accent}50`,
                            }}
                        >
                            {step === STEPS.length - 1 ? 'done' : 'next →'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
