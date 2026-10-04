import { writeFile } from 'node:fs/promises';
import { createDoranDoranSvg } from '../src/lib/dorandoran-art.js';
for (const mood of ['happy', 'waiting', 'thinking', 'focus', 'sad', 'calm']) {
  await writeFile(new URL(`../public/characters/dorandoran-${mood}.svg`, import.meta.url), createDoranDoranSvg({ mood }) + '\n');
}
const artwork = createDoranDoranSvg({ mood: 'happy' }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
await writeFile(new URL('../public/icon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0f172a"/><g transform="translate(36 75) scale(1.83)">${artwork}</g></svg>\n`);

// Raster outputs are rendered only from this repository's SVG and OG template.
// Requires the development browser: npx playwright install chromium
if (process.argv.includes('--raster')) {
  const { chromium } = await import('@playwright/test');
  const { readFile } = await import('node:fs/promises');
  const { pathToFileURL, fileURLToPath } = await import('node:url');
  const { resolve } = await import('node:path');
  const project = fileURLToPath(new URL('../', import.meta.url));
  const icon = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
  const browser = await chromium.launch();
  try {
    for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${icon}`);
      await page.screenshot({ path: resolve(project, 'public', file), omitBackground: true, type: 'png' });
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(resolve(project, 'tests/og-card.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.mascot img').evaluate(image => image.decode());
    await page.screenshot({ path: resolve(project, 'public/og-image.jpg'), type: 'jpeg', quality: 92 });
    await page.close();
  } finally { await browser.close(); }
}
