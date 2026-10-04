import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const project = new URL('../', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('licenses/inventory.json', project), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (file) => readFile(new URL(file, project));
const originals = new Map();

// Do not silently reuse a notice snapshot after changing either dependency lock.
for (const lock of inventory.locks) {
  if (hash(await read(lock.file)) !== lock.sha256) throw new Error(`License inventory is stale: ${lock.file}`);
}
const projectLicense = await read(inventory.projectLicense.file);
if (hash(projectLicense) !== inventory.projectLicense.sha256) throw new Error('Project LICENSE changed; update its reviewed hash.');
for (const component of inventory.components) {
  for (const notice of component.notices) {
    if (originals.has(notice.sha256)) continue;
    const bytes = await read(notice.file);
    if (hash(bytes) !== notice.sha256) throw new Error(`License original changed: ${notice.file}`);
    originals.set(notice.sha256, bytes);
  }
}
for (const font of inventory.fonts) {
  const bytes = await read(font.licenseFile);
  if (hash(bytes) !== font.licenseSha256) throw new Error(`Font license original changed: ${font.name}`);
  if (font.fontFile && hash(await read(font.fontFile)) !== font.fontSha256) throw new Error(`Font bytes changed: ${font.name}`);
  originals.set(font.licenseSha256, bytes);
}

function generate(scope) {
  const components = inventory.components.filter((component) => component.scope === scope && component.installed && component.classification === 'production');
  const sections = new Map();
  const lines = ['DoranDoran — third-party notices', `Inventory snapshot: ${inventory.auditDate}; scope: ${scope}`, '',
    'This is the installed production dependency closure, a conservative superset of modules delivered in a browser bundle.',
    'JSZip is used under the MIT option of its dual MIT OR GPL license. The unmodified upstream license document is retained.',
    'Original documents and copyright statements below remain under their respective licenses.', '', 'Components:'];
  for (const component of components) {
    lines.push(`${component.name}@${component.version} | ${component.selectedLicense} | ${component.registry}`);
    if (component.attribution) lines.push(`  Published author attribution: ${component.attribution}`);
    if (component.publicationNote) lines.push(`  Original publication format: ${component.publicationNote}`);
    if (component.reviewGap) lines.push(`  Notice provenance limitation: ${component.reviewGap}`);
    for (const notice of component.notices) {
      const entry = sections.get(notice.sha256) || { owners: [], sources: new Set() };
      entry.owners.push(`${component.name}@${component.version}`);
      entry.sources.add(notice.source);
      sections.set(notice.sha256, entry);
    }
  }
  if (scope === 'root') {
    lines.push('', 'Fonts:');
    for (const font of inventory.fonts) {
      lines.push(`${font.name}@${font.version} | OFL-1.1 | ${font.url}`);
      sections.set(font.licenseSha256, { owners: [`${font.name}@${font.version}`], sources: new Set([font.source]) });
    }
  }
  const chunks = [Buffer.from(lines.join('\n') + '\n\n')];
  for (const [sha, section] of sections) {
    const owners = [...new Set(section.owners)].sort();
    chunks.push(Buffer.from(`\n--- Original notice; SHA-256 ${sha} ---\nApplies to: ${owners.join(', ')}\nSources: ${[...section.sources].join('; ')}\n\n`));
    chunks.push(originals.get(sha));
    chunks.push(Buffer.from('\n'));
  }
  return Buffer.concat(chunks);
}

const outputs = new Map([
  ['public/LICENSE.txt', projectLicense],
  ['functions/LICENSE.txt', projectLicense],
  ['public/THIRD_PARTY_NOTICES.txt', generate('root')],
  ['functions/THIRD_PARTY_NOTICES.txt', generate('functions')],
]);
for (const font of inventory.fonts) outputs.set(`public/licenses/${font.file}`, originals.get(font.licenseSha256));
if (process.argv.includes('--check')) {
  for (const [file, bytes] of outputs) {
    if (!(await read(file)).equals(bytes)) throw new Error(`Generated notice is stale: ${file}`);
  }
  console.log(`License snapshot verified: ${inventory.components.length} locked package locations, ${outputs.size} notice outputs.`);
} else {
  await mkdir(new URL('public/licenses/', project), { recursive: true });
  for (const [file, bytes] of outputs) await writeFile(new URL(file, project), bytes);
  console.log(`Generated ${outputs.size} notice outputs; original text hashes verified.`);
}
