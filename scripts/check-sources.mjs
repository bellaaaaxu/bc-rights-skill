// scripts/check-sources.mjs
// Weekly check of the official sources in skills/*/references/sources.json.
//   node scripts/check-sources.mjs            check; write last_checked and status; report to .local/check-report.md
//   node scripts/check-sources.mjs --if-due   the daily scheduled run: check only if due (see due() in lib/check.mjs)
//   node scripts/check-sources.mjs --accept   after a person has re-read the changed sources: set baseline and last_human_verified
// Exit code 1 when anything changed, is new, or could not be checked (unless --accept).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, applyResults, report, withRetry, due } from './lib/check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcesPath = join(root, 'skills', 'bc-unpaid-wages', 'references', 'sources.json');
const reportPath = join(root, '.local', 'check-report.md');
const accept = process.argv.includes('--accept');
const today = new Date().toLocaleDateString('en-CA'); // local date, YYYY-MM-DD
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) bc-rights-skill-source-check';

function findCanadaLaw() {
  const c = [
    process.env.CANADA_LAW_CLI,
    join(homedir(), '.agents', 'skills', 'canada-employment-law', 'scripts', 'bclaw.mjs'),
    join(homedir(), '.claude', 'skills', 'canada-employment-law', 'scripts', 'bclaw.mjs'),
  ];
  return c.find((p) => p && existsSync(p)) ?? null;
}
const cli = findCanadaLaw();

const io = {
  get: (url) => withRetry(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer()).toString('utf8');
  }),
  sha: (s) => createHash('sha256').update(s).digest('hex'),
  law: async (act, sec) => {
    if (!cli) throw new Error('canada-law script not found: set CANADA_LAW_CLI or install canada-law');
    const j = JSON.parse(execFileSync(process.execPath, [cli, 'section', act, sec], { encoding: 'utf8' }));
    return { text: j.text, current_to: j.citation.current_to };
  },
};

const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'));
if (process.argv.includes('--if-due') && !due(sources, today)) {
  console.log('Not due: checked within the last 7 days and every source was reached.');
  process.exit(0);
}
const results = await evaluate(sources, io);
const next = applyResults(sources, results, today, accept);
writeFileSync(sourcesPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
mkdirSync(dirname(reportPath), { recursive: true });
const md = report(results, sources, today);
writeFileSync(reportPath, md, 'utf8');
console.log(md);
console.log(cli ? `canada-law: ${cli}` : 'canada-law: NOT FOUND (law sources not checked)');
const clean = results.every((r) => r.status === 'ok');
process.exit(accept || clean ? 0 : 1);
