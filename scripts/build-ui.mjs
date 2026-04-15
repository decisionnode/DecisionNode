#!/usr/bin/env node
// Build script for the decisionnode UI.
//   1. esbuild:    src/ui/client/app.tsx -> dist/ui/app.js
//   2. tailwindcss: src/ui/client/styles/tailwind.css -> dist/ui/style.css
//   3. copy:       src/ui/index.html -> dist/ui/index.html

import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcUi = path.join(root, 'src', 'ui');
const distUi = path.join(root, 'dist', 'ui');

mkdirSync(distUi, { recursive: true });

// 1. Bundle Preact app with esbuild
await build({
    entryPoints: [path.join(srcUi, 'client', 'app.tsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    outfile: path.join(distUi, 'app.js'),
    loader: {
        '.svg': 'dataurl',
        '.png': 'dataurl',
    },
    define: {
        'process.env.NODE_ENV': '"production"',
    },
    logLevel: 'info',
});

// 2. Build Tailwind CSS
const tailwindInput = path.join(srcUi, 'client', 'styles', 'tailwind.css');
const tailwindOutput = path.join(distUi, 'style.css');
if (existsSync(tailwindInput)) {
    execSync(
        `npx @tailwindcss/cli -i "${tailwindInput}" -o "${tailwindOutput}" --minify`,
        { stdio: 'inherit', cwd: root }
    );
}

// 3. Copy static HTML shell
copyFileSync(path.join(srcUi, 'index.html'), path.join(distUi, 'index.html'));

// 4. Copy shared brand logo from the website's asset directory so the UI stays
//    visually consistent with the rest of the product.
const logoSrc = path.join(root, 'website', 'src', 'assets', 'images', 'DecisionNode-transparent.png');
if (existsSync(logoSrc)) {
    copyFileSync(logoSrc, path.join(distUi, 'logo.png'));
}

// 5. Copy the same favicons the website ships so the browser tab icon
//    looks crisp instead of the squashed 200KB logo.
const faviconSources = [
    ['favicon.svg', 'favicon.svg'],
    ['favicon-32.png', 'favicon-32.png'],
    ['favicon-256.png', 'favicon-256.png'],
];
for (const [src, dst] of faviconSources) {
    const from = path.join(root, 'website', 'public', src);
    if (existsSync(from)) {
        copyFileSync(from, path.join(distUi, dst));
    }
}

console.log('UI build complete: dist/ui/');
