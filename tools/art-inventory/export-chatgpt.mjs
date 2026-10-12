// Writes the ChatGPT project instructions and the art catalogue file from the
// built inventory page, so they always match its batches.
// usage: node export-chatgpt.mjs <built art-inventory.html> <out dir>
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [page = 'art-inventory.html', out = 'chatgpt'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.goto('file://' + resolve(page));
const { project, catalogue } = await p.evaluate(() => ({ project: TEXTS.project, catalogue: TEXTS.catalogue }));
await b.close();
if (project.length > 8000) throw new Error(`project instructions are ${project.length} characters; ChatGPT projects allow 8,000`);
writeFileSync(`${out}/project-instructions.txt`, project + '\n');
writeFileSync(`${out}/shattered-reef-art-catalogue.txt`, catalogue + '\n');
console.log('project instructions:', project.length, 'characters; catalogue:', catalogue.split('\n').length, 'lines');
