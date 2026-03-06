/**
 * Compila el catch-all de Pages Functions en dist/functions/ para que
 * "wrangler pages deploy dist" incluya assets + functions.
 * Requiere: npm run build (vite) ya ejecutado para que exista dist/.
 */
import * as esbuild from 'esbuild';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const outDir = path.join(distDir, 'functions');
const entry = path.join(root, 'functions', '[[path]].ts');

if (!existsSync(distDir)) {
  console.warn('build-pages-functions: dist/ no existe. Ejecuta "npm run build" primero.');
  process.exit(1);
}
if (!existsSync(entry)) {
  console.warn('build-pages-functions: functions/[[path]].ts no encontrado.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// _routes.json: todas las rutas pasan por la Function (API + fallback a assets).
writeFileSync(
  path.join(distDir, '_routes.json'),
  JSON.stringify({ version: 1, include: ['/*'], exclude: [] }, null, 2)
);

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'esnext',
  mainFields: ['module', 'main'],
  outfile: path.join(outDir, '[[path]].js'),
  external: [],
  sourcemap: false,
  minify: true,
  outExtension: { '.js': '.js' },
});

console.log('Pages Functions compiladas en dist/functions/');
