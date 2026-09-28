// evals/run/run-codex.mjs: the same procedure / journey sets on OpenAI Codex CLI (second model).
//   node evals/run/run-codex.mjs --set procedure|journey|journey-holdout [--arms bare,skill,fallback] [--only ids] [--dry-run] [--model <m>] [--effort low|medium|high]
// Model and reasoning effort default to ~/.codex/config.toml; whichever applies is written into mapping.json (the --json output does not say).
// Codex reads skills from ~/.agents/skills, so arms are made by moving folders there (and restoring afterwards):
//   bare      neither bc-unpaid-wages nor canada-employment-law visible
//   skill     both visible
//   fallback  bc-unpaid-wages visible; canada-employment-law hidden in ~/.agents/skills and ~/.claude/skills
// Output: .local/eval-runs/<time>-codex/runs/<case>-<arm>.jsonl, blind/<random>.md, mapping.json, scores.csv
// Uses the tester's ChatGPT plan. Codex does not report dollars; token counts are recorded instead.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoChecks } from './checks.mjs';

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const set = opt('--set');
const arms = (opt('--arms') ?? 'bare,skill').split(',');
const only = opt('--only')?.split(',');
const model = opt('--model');
const effort = opt('--effort');
const dry = args.includes('--dry-run');
if (!set) { console.error('--set procedure|journey|journey-holdout'); process.exit(2); }
for (const a of arms) if (!['bare', 'skill', 'fallback'].includes(a)) { console.error(`unknown arm ${a}`); process.exit(2); }

const root = fileURLToPath(new URL('../../', import.meta.url));
const cases = readFileSync(join(root, 'evals', set, 'cases.jsonl'), 'utf8').trim().split('\n').map(JSON.parse).filter((c) => !only || only.includes(c.id));
const codex = process.env.CODEX_BIN ?? (process.platform === 'win32' ? join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm', 'codex.cmd') : 'codex');
// Defaults from Codex's own config, so mapping.json records what actually ran.
const codexConfig = (() => { try { return readFileSync(join(homedir(), '.codex', 'config.toml'), 'utf8'); } catch { return ''; } })();
const cfgVal = (k) => codexConfig.match(new RegExp('^' + k + '\s*=\s*"([^"]*)"', 'm'))?.[1] ?? null;
const modelUsed = model ?? cfgVal('model');
const effortUsed = effort ?? cfgVal('model_reasoning_effort');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + '-codex';
const out = join(root, '.local', 'eval-runs', stamp);
const agentsSkills = join(homedir(), '.agents', 'skills');
const claudeSkills = join(homedir(), '.claude', 'skills');
const sources = JSON.parse(readFileSync(join(root, 'skills', 'bc-unpaid-wages', 'references', 'sources.json'), 'utf8'));
const allowedUrlPrefixes = sources.sources.filter((s) => s.url).map((s) => s.url);

// Which skill folders must be hidden for an arm. Restored in `finally`.
const hideFor = { bare: [join(agentsSkills, 'bc-unpaid-wages'), join(agentsSkills, 'canada-employment-law'), join(claudeSkills, 'canada-employment-law')], skill: [], fallback: [join(agentsSkills, 'canada-employment-law'), join(claudeSkills, 'canada-employment-law')] };
// Codex discovers a skill by scanning every subfolder of the skills root for a SKILL.md, whatever the folder is
// called, so renaming in place does not hide it. Move the folder out of the root (to <root>/../.hidden-by-eval/).
const parking = (p) => join(p, '..', '..', '.hidden-by-eval', p.split(/[\\/]/).pop());
function hide(paths) {
  const moved = [];
  for (const p of paths) if (existsSync(p)) { mkdirSync(join(parking(p), '..'), { recursive: true }); renameSync(p, parking(p)); moved.push(p); }
  return moved;
}
function restore(moved) { for (const p of moved) if (existsSync(parking(p))) renameSync(parking(p), p); }

// The prompt goes in on stdin ("-"), so no user text has to survive cmd.exe quoting.
const argv = (lastFile, cwd) => ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '--json', '-o', lastFile, '-C', cwd, ...(model ? ['-m', model] : []), ...(effort ? ['-c', `model_reasoning_effort=${effort}`] : []), '-'];
const quote = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

function summarise(jsonl, last) {
  const ev = jsonl.split('\n').flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const text = jsonl;
  // Codex --json: look for any usage object with input/output token counts and take the last one seen.
  const usages = ev.map((e) => e?.usage ?? e?.info?.total_token_usage ?? e?.item?.usage ?? null).filter(Boolean);
  const lastUsage = usages[usages.length - 1];
  const summed = lastUsage ? (lastUsage.total_tokens ?? ((lastUsage.input_tokens ?? 0) + (lastUsage.output_tokens ?? 0))) : 0;
  const tokens = summed > 0 ? summed : null;
  return {
    model: ev.find((e) => e?.model)?.model ?? null,
    skill_used: /bc-unpaid-wages[\\/]+SKILL\.md/.test(text),
    status_run: /status\.mjs/.test(text),
    law_fetched: /bclaw\.mjs/.test(text),
    web_used: /web_search|"type":"web_search/i.test(text),
    tokens,
    answer: last,
  };
}

const mapping = [];
for (const arm of arms) {
  if (!existsSync(join(agentsSkills, 'bc-unpaid-wages')) && arm !== 'bare') { console.error(`copy skills/bc-unpaid-wages to ${agentsSkills} first`); process.exit(2); }
  const cwd = join(root, '.eval-tmp', `codex-${set}-${arm}`);
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(cwd, { recursive: true });
  const moved = dry ? [] : hide(hideFor[arm]);
  try {
    for (const c of cases) {
      const lastFile = join(out, 'runs', `${c.id}-${arm}.last.md`);
      if (dry) { console.log(`${c.id} ${arm}: codex ${argv(lastFile, cwd).map((a) => JSON.stringify(a)).join(' ')}  <<< prompt on stdin`); continue; }
      mkdirSync(join(out, 'runs'), { recursive: true });
      mkdirSync(join(out, 'blind'), { recursive: true });
      const cmd = [quote(codex), ...argv(lastFile, cwd).map(quote)].join(' ');
      const r = spawnSync(cmd, { shell: true, input: c.q, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
      const jsonl = r.stdout ?? '';
      writeFileSync(join(out, 'runs', `${c.id}-${arm}.jsonl`), jsonl + (r.stderr ? `\n#stderr\n${r.stderr}` : ''));
      const last = existsSync(lastFile) ? readFileSync(lastFile, 'utf8') : '(no last message)';
      const s = summarise(jsonl, last);
      const key = randomBytes(4).toString('hex');
      writeFileSync(join(out, 'blind', `${key}.md`), `# ${key}\n\n**Question:** ${c.q}\n\n---\n\n${s.answer}\n`);
      const auto = autoChecks(s.answer, { allowedUrlPrefixes, fallback: arm === 'fallback' });
      mapping.push({ key, case: c.id, set, arm, engine: 'codex', ...s, model: modelUsed, effort: effortUsed, answer: undefined, auto });
      writeFileSync(join(out, 'mapping.json'), JSON.stringify(mapping, null, 2)); // after every answer
      // The blind key is deliberately not printed: the grader must not see which key belongs to which arm.
      console.log(`${c.id} ${arm} [${modelUsed} ${effortUsed}]: tokens=${s.tokens ?? '?'} skill=${s.skill_used ? 'Y' : 'n'} law=${s.law_fetched ? 'Y' : 'n'} web=${s.web_used ? 'Y' : 'n'} auto=${auto.join(',') || '-'}`);
    }
  } finally {
    restore(moved);
  }
}
if (!dry) {
  writeFileSync(join(out, 'mapping.json'), JSON.stringify(mapping, null, 2));
  writeFileSync(join(out, 'scores.csv'), 'key,B1,B2,B3,B4,B5,B6,B7,B8,F1,F2,N1,N2,N3,journey1,journey2,journey3,journey4,journey5,journey6,category,notes\n' + mapping.map((m) => m.key).sort().map((k) => `${k},,,,,,,,,,,,,,,,,,,,,\n`).join(''));
  console.log(`\n${out}\nGrade blind/ first (fill scores.csv, rubric.md), then open mapping.json.`);
}
