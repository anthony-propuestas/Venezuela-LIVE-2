/**
 * Post-build: Lee dist/index.html, extrae assets y genera sw.js con precache.
 * Ejecutar después de "vite build".
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

const htmlPath = path.join(distDir, 'index.html');
const swTemplatePath = path.join(root, 'public', 'sw.js');
const swOutPath = path.join(distDir, 'sw.js');

const html = readFileSync(htmlPath, 'utf-8');
const swTemplate = readFileSync(swTemplatePath, 'utf-8');

// Extraer URLs de scripts y estilos del HTML de salida
const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
const styles = [...html.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map(m => m[1]);

const precacheList = ['/', '/manifest.webmanifest', ...scripts, ...styles];

// El SW espera la variable __PRECACHE__ inyectada
const swWithPrecache = swTemplate.replace(
  "'__PRECACHE_URLS__'",
  JSON.stringify(precacheList)
);

writeFileSync(swOutPath, swWithPrecache, 'utf-8');
console.log('[inject-precache] sw.js generado con', precacheList.length, 'URLs');
