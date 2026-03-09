/**
 * Genera public/favicon.ico a partir de public/icons/icon.svg.
 * Requiere: sharp, to-ico (devDependencies).
 * Uso: node scripts/generate-favicon.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'public', 'icons', 'icon.svg');
const outPath = path.join(root, 'public', 'favicon.ico');

const SIZES = [16, 32, 48];

const svgBuffer = readFileSync(svgPath);
const pngBuffers = await Promise.all(
  SIZES.map((size) =>
    sharp(svgBuffer).resize(size, size).png().toBuffer()
  )
);

const icoBuffer = await toIco(pngBuffers);
writeFileSync(outPath, icoBuffer);
console.log('Generado:', outPath);
