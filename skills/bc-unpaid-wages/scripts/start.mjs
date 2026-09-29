// skills/bc-unpaid-wages/scripts/start.mjs
// One command for the first reply: prints the status JSON (see status.mjs), then the two reference files the first
// reply needs (01 routing and deadlines, 02 first action). Saves the assistant two or three tool calls, which is
// usage the person pays for. Node 20+, no dependencies.
//   node scripts/start.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { status } from './status.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIRST_REPLY_FILES = ['01-routing-deadlines.md', '02-first-action.md'];

export function startText(skillDir = join(HERE, '..'), today = new Date()) {
  const sources = JSON.parse(readFileSync(join(skillDir, 'references', 'sources.json'), 'utf8'));
  const parts = [`===== status =====\n${JSON.stringify(status(sources, today), null, 2)}`];
  for (const f of FIRST_REPLY_FILES) parts.push(`===== references/${f} =====\n${readFileSync(join(skillDir, 'references', f), 'utf8').trim()}`);
  parts.push('===== end: read references/03 to 07 only when the flow reaches them =====');
  return parts.join('\n\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.stdout.write(startText());
