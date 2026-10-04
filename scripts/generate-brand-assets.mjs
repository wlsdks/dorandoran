import { writeFile } from 'node:fs/promises';
import { createDoranDoranSvg } from '../src/lib/dorandoran-art.js';
for (const mood of ['happy', 'waiting', 'thinking', 'focus', 'sad', 'calm']) {
  await writeFile(new URL(`../public/characters/dorandoran-${mood}.svg`, import.meta.url), createDoranDoranSvg({ mood }) + '\n');
}
const artwork = createDoranDoranSvg({ mood: 'happy' }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
await writeFile(new URL('../public/icon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0f172a"/><g transform="translate(36 75) scale(1.83)">${artwork}</g></svg>\n`);
