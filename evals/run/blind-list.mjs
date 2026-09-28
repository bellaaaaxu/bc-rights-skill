// evals/run/blind-list.mjs: print blind answers for grading, without the arm.
//   node evals/run/blind-list.mjs <run-folder> [--from N] [--count M] [--keys k1,k2]
// Reads blind/<key>.md (question + answer) and, from mapping.json, only the auto hints and the case id for each key.
// Never prints the arm. Keys are listed in sorted order so batches are stable.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const dir = args[0];
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
if (!dir) { console.error('usage: node evals/run/blind-list.mjs <run-folder> [--from N] [--count M] [--keys k1,k2]'); process.exit(2); }
const from = Number(opt('--from') ?? 0);
const count = Number(opt('--count') ?? 10);
const keysOpt = opt('--keys')?.split(',');
const mapping = JSON.parse(readFileSync(join(dir, 'mapping.json'), 'utf8'));
const hints = Object.fromEntries(mapping.map((m) => [m.key, { case: m.case, set: m.set, auto: m.auto ?? [] }]));
const keys = readdirSync(join(dir, 'blind')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
const pick = keysOpt ?? keys.slice(from, from + count);
console.log(`${keys.length} blind answers in ${dir}; showing ${pick.length} (${keysOpt ? 'by key' : `from ${from}`})\n`);
for (const k of pick) {
  const md = readFileSync(join(dir, 'blind', `${k}.md`), 'utf8');
  const h = hints[k] ?? { case: '?', set: '?', auto: [] };
  console.log(`\n${'='.repeat(100)}\nKEY ${k}  case ${h.case}  set ${h.set}  auto-hints ${h.auto.join(',') || '-'}\n${'='.repeat(100)}\n`);
  console.log(md.replace(/^# .*\n\n/, ''));
}
