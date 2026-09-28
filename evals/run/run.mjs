// evals/run/run.mjs: procedure and journey sets, several arms, blind output.
//   node evals/run/run.mjs --set procedure|journey|journey-holdout [--arms bare,skill,fallback] [--only p01-zh,p02-en] [--dry-run] [--model <m>]
// Arms:
//   bare      empty project, web tools on: an ordinary AI that can browse
//   skill     project holds bc-unpaid-wages + canada-employment-law (script tier), web tools on
//   fallback  project holds bc-unpaid-wages only, and ~/.claude/skills/canada-employment-law is moved away during the run
// Output: .local/eval-runs/<time>/runs/<case>-<arm>.jsonl, blind/<random>.md (answer only), mapping.json
// Spends the tester's own Claude usage; one process at a time (parallel `claude` processes collided on ~/.claude.json).
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoChecks } from './checks.mjs';
import { findClaude } from './find-claude.mjs';

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const set = opt('--set');
const arms = (opt('--arms') ?? 'bare,skill').split(',');
const only = opt('--only')?.split(',');
const model = opt('--model');
const dry = args.includes('--dry-run');
const outOpt = opt('--out'); // append into an existing run folder (chunked runs share one mapping.json)
if (!set) { console.error('--set procedure|journey|journey-holdout'); process.exit(2); }
for (const a of arms) if (!['bare', 'skill', 'fallback'].includes(a)) { console.error(`unknown arm ${a}`); process.exit(2); }

const root = fileURLToPath(new URL('../../', import.meta.url));
const cases = readFileSync(join(root, 'evals', set, 'cases.jsonl'), 'utf8').trim().split('\n').map(JSON.parse).filter((c) => !only || only.includes(c.id));
const claude = findClaude();
const today = new Date().toLocaleDateString('en-CA');
if (dry) console.log(`claude binary: ${claude}${model ? ` (model ${model})` : ' (CLI default model)'}`);
const SYSTEM = `You are an AI assistant. Today's date is ${today}. Use the tools and skills you have when they would make your answer more accurate or more up to date.`;
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const out = outOpt ? (outOpt.includes('/') || outOpt.includes('\\') ? outOpt : join(root, '.local', 'eval-runs', outOpt)) : join(root, '.local', 'eval-runs', stamp);
const homeSkills = join(homedir(), '.claude', 'skills');
const canadaLawHome = join(homeSkills, 'canada-employment-law');
// status.mjs looks in ~/.agents/skills first, then ~/.claude/skills: the fallback arm must hide both.
const toHide = [join(homedir(), '.agents', 'skills', 'canada-employment-law'), canadaLawHome];
function hide(paths) { const moved = []; for (const p of paths) if (existsSync(p)) { renameSync(p, p + '.hidden-by-eval'); moved.push(p); } return moved; }
function restore(moved) { for (const p of moved) if (existsSync(p + '.hidden-by-eval')) renameSync(p + '.hidden-by-eval', p); }
const sources = JSON.parse(readFileSync(join(root, 'skills', 'bc-unpaid-wages', 'references', 'sources.json'), 'utf8'));
const allowedUrlPrefixes = sources.sources.filter((s) => s.url).map((s) => s.url);

function project(arm) {
  const dir = join(root, '.eval-tmp', `${set}-${arm}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, '.claude', 'skills'), { recursive: true });
  if (arm === 'skill' || arm === 'fallback') cpSync(join(root, 'skills', 'bc-unpaid-wages'), join(dir, '.claude', 'skills', 'bc-unpaid-wages'), { recursive: true });
  if (arm === 'skill') {
    if (!existsSync(canadaLawHome)) { console.error(`skill arm needs ${canadaLawHome} (copy it from the canada-law repo)`); process.exit(2); }
    cpSync(canadaLawHome, join(dir, '.claude', 'skills', 'canada-employment-law'), { recursive: true });
  }
  return dir;
}

const argv = (q) => [
  '-p', q, '--system-prompt', SYSTEM, '--setting-sources', 'project', '--strict-mcp-config',
  '--tools', 'Bash,Read,Glob,Grep,Skill,WebFetch,WebSearch',
  '--allowedTools', 'Bash(node *)', 'Read', 'Glob', 'Grep', 'Skill', 'WebFetch', 'WebSearch',
  '--no-session-persistence', '--max-budget-usd', '2', '--output-format', 'stream-json', '--verbose',
  ...(model ? ['--model', model] : []),
];

function summarise(jsonl) {
  const ev = jsonl.split('\n').flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const init = ev.find((e) => e.type === 'system' && e.subtype === 'init');
  const uses = ev.flatMap((e) => (e.type === 'assistant' && Array.isArray(e.message?.content) ? e.message.content.filter((b) => b.type === 'tool_use') : []));
  const res = ev.find((e) => e.type === 'result');
  const cmds = uses.filter((u) => u.name === 'Bash').map((u) => String(u.input?.command ?? ''));
  return {
    model: init?.model ?? null,
    skill_listed: (init?.skills ?? []).includes('bc-unpaid-wages'),
    skill_used: uses.some((u) => u.name === 'Skill' && u.input?.skill === 'bc-unpaid-wages'),
    status_run: cmds.some((c) => c.includes('status.mjs')),
    law_fetched: cmds.some((c) => c.includes('bclaw.mjs')) || uses.some((u) => String(u.name).includes('get_section')),
    web_used: uses.some((u) => u.name === 'WebSearch' || u.name === 'WebFetch'),
    turns: res?.num_turns ?? null,
    cost_usd: res?.total_cost_usd ?? null,
    answer: res?.result ?? '(no result event)',
  };
}

const mappingPath = join(out, 'mapping.json');
const mapping = existsSync(mappingPath) ? JSON.parse(readFileSync(mappingPath, 'utf8')) : [];
let total = 0;
for (const arm of arms) {
  const cwd = project(arm);
  const moved = arm === 'fallback' && !dry ? hide(toHide) : [];
  try {
    for (const c of cases) {
      if (dry) { console.log(`${c.id} ${arm}: claude ${argv(c.q).map((a) => JSON.stringify(a)).join(' ')}`); continue; }
      mkdirSync(join(out, 'runs'), { recursive: true });
      mkdirSync(join(out, 'blind'), { recursive: true });
      const r = spawnSync(claude, argv(c.q), { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
      const jsonl = r.stdout ?? '';
      writeFileSync(join(out, 'runs', `${c.id}-${arm}.jsonl`), jsonl + (r.stderr ? `\n#stderr\n${r.stderr}` : ''));
      const s = summarise(jsonl);
      const key = randomBytes(4).toString('hex');
      writeFileSync(join(out, 'blind', `${key}.md`), `# ${key}\n\n**Question:** ${c.q}\n\n---\n\n${s.answer}\n`);
      const auto = autoChecks(s.answer, { allowedUrlPrefixes, fallback: arm === 'fallback' });
      mapping.push({ key, case: c.id, set, arm, ...s, answer: undefined, auto });
      writeFileSync(mappingPath, JSON.stringify(mapping, null, 2)); // after every answer, so a killed run loses nothing
      total += s.cost_usd ?? 0;
      // The blind key is deliberately not printed: the grader must not see which key belongs to which arm.
      console.log(`${c.id} ${arm}: $${s.cost_usd?.toFixed(2) ?? '?'} turns=${s.turns} skill=${s.skill_used ? 'Y' : 'n'} law=${s.law_fetched ? 'Y' : 'n'} web=${s.web_used ? 'Y' : 'n'} auto=${auto.join(',') || '-'}`);
      if (total > 25) { console.error('stopping: more than US$25 spent'); break; }
    }
  } finally {
    restore(moved);
  }
}
if (!dry) {
  writeFileSync(join(out, 'scores.csv'), 'key,B1,B2,B3,B4,B5,B6,B7,B8,F1,F2,N1,N2,N3,journey1,journey2,journey3,journey4,journey5,journey6,category,notes\n' + mapping.map((m) => m.key).sort().map((k) => `${k},,,,,,,,,,,,,,,,,,,,,\n`).join(''));
  console.log(`\n${out}\nTotal $${total.toFixed(2)}. Grade blind/ first (fill scores.csv, rubric.md), then open mapping.json.`);
}
