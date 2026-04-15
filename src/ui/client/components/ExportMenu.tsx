import { useEffect, useRef, useState } from 'preact/hooks';
import type { ExportFormat } from '../lib/export';

interface ExportMenuProps {
    onExport: (format: ExportFormat) => void;
    onOpenInfo: () => void;
}

export function ExportMenu({ onExport, onOpenInfo }: ExportMenuProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div class="fixed right-5 top-4 z-30 flex items-center gap-2">
            {/* Info button — opens the views explainer modal */}
            <button
                onClick={onOpenInfo}
                class="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-zinc-950/80 text-zinc-400 shadow-2xl shadow-black/50 backdrop-blur-md transition hover:border-white/20 hover:text-zinc-100"
                aria-label="What am I looking at?"
                title="What am I looking at?"
            >
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
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
            </button>

            {/* Export button + dropdown */}
            <div ref={ref} class="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                class={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs shadow-2xl shadow-black/50 backdrop-blur-md transition ${
                    open
                        ? 'border-primary-400/50 bg-primary-500/10 text-primary-300'
                        : 'border-white/10 bg-zinc-950/80 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
                aria-label="Export"
            >
                <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>export</span>
            </button>

            {open && (
                <div class="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/70 backdrop-blur-md animate-fade-in">
                    <button
                        onClick={() => {
                            setOpen(false);
                            onExport('download');
                        }}
                        class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/5"
                    >
                        <span>Download PNG</span>
                        <span class="font-mono text-[10px] text-zinc-600">3× DPI</span>
                    </button>
                    <button
                        onClick={() => {
                            setOpen(false);
                            onExport('clipboard');
                        }}
                        class="flex w-full items-center justify-between gap-3 border-t border-white/5 px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/5"
                    >
                        <span>Copy to clipboard</span>
                        <span class="font-mono text-[10px] text-zinc-600">PNG</span>
                    </button>
                </div>
            )}
            </div>
        </div>
    );
}
