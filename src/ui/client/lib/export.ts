/**
 * Helpers for exporting the current visualization to PNG or clipboard.
 * Each view (Graph, VectorSpace) registers an exporter via app.tsx state
 * which is then invoked by the TopBar export menu.
 */

export type ExportFormat = 'download' | 'clipboard';

export interface Exporter {
    /** Returns a PNG blob of the current view at the given pixel scale */
    toPngBlob(scale: number): Promise<Blob | null>;
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
    if (typeof ClipboardItem === 'undefined') return false;
    try {
        await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob }),
        ]);
        return true;
    } catch {
        return false;
    }
}

export function todayFilename(prefix: string, ext: string): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${prefix}-${y}${m}${day}-${hh}${mm}.${ext}`;
}
