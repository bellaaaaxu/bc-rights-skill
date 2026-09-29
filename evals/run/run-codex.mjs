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
for (const a of arms) if (!['bare', 'skill', 'fallback', 'chat'].includes(a)) { console.error(`unknown arm ${a}`); process.exit(2); }

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

// Which folders must be hidden for an arm. Restored in `finally`. Every arm hides Codex's own memory folder
// (~/.codex/memories, written by the desktop app from imported sessions): in the M4 sample 10 of 20 runs searched it.
const codexMemories = join(homedir(), '.codex', 'memories');
const hideFor = { bare: [join(agentsSkills, 'bc-unpaid-wages'), join(agentsSkills, 'canada-employment-law'), join(claudeSkills, 'canada-employment-law'), codexMemories], skill: [codexMemories], fallback: [join(agentsSkills, 'canada-employment-law'), join(claudeSkills, 'canada-employment-law'), codexMemories] };
// chat: the chat pack pasted before the question, as in a chat app; no skills, no memories, web search disabled.
// Codex still has a shell and its own plugins (computer use); the pack tells it that it cannot run anything.
hideFor.chat = hideFor.bare;
const packPath = join(root, 'dist', 'bc-unpaid-wages-chat.md');
const pack = existsSync(packPath) ? readFileSync(packPath, 'utf8') : null;
if (arms.includes('chat') && !pack) { console.error('chat arm needs dist/bc-unpaid-wages-chat.md: run node scripts/build-chat-pack.mjs'); process.exit(2); }
const promptFor = (arm, q) => (arm === 'chat' ? `${pack}\n\n---\n\n我的情况 / My situation:\n\n${q}` : q);
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
const argv = (lastFile, cwd, arm) => ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '--json', '-o', lastFile, '-C', cwd, ...(model ? ['-m', model] : []), ...(effort ? ['-c', `model_reasoning_effort=${effort}`] : []), ...(arm === 'chat' ? ['-c', 'web_search=disabled'] : []), '-'];
const quote = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

function summarise(jsonl, last) {
  const ev = jsonl.split('\n').flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  // Codex --json: look for any usage object with input/output token counts and take the last one seen.
  const usages = ev.map((e) => e?.usage ?? e?.info?.total_token_usage ?? e?.item?.usage ?? null).filter(Boolean);
  const lastUsage = usages[usages.length - 1];
  const summed = lastUsage ? (lastUsage.total_tokens ?? ((lastUsage.input_tokens ?? 0) + (lastUsage.output_tokens ?? 0))) : 0;
  const tokens = summed > 0 ? summed : null;
  // Judge tool use from the command items, not from the whole log: a bare-arm run once matched "bclaw.mjs" only because
  // Codex's own memory file (~/.codex/memories, written by the desktop app from imported sessions) mentions it.
  const items = ev.filter((e) => e.type === 'item.completed' && e.item).map((e) => e.item);
  const cmds = items.filter((i) => i.type === 'command_execution').map((i) => i.command || '');
  const mem = (c) => /\.codex[\\/]+memories/i.test(c);
  return {
    model: ev.find((e) => e?.model)?.model ?? null,
    skill_used: cmds.some((c) => /bc-unpaid-wages[\\/]+SKILL\.md/i.test(c)),
    status_run: cmds.some((c) => /status\.mjs/.test(c)),
    law_fetched: cmds.some((c) => /bclaw\.mjs/.test(c) && !mem(c)),
    web_used: items.some((i) => /web_search/i.test(i.type || '')),
    memory_read: cmds.some(mem),
    commands: cmds.length,
    mcp_calls: items.filter((i) => i.type === 'mcp_tool_call').length,
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
      if (dry) { console.log(`${c.id} ${arm}: codex ${argv(lastFile, cwd, arm).map((a) => JSON.stringify(a)).join(' ')}  <<< prompt on stdin`); continue; }
      mkdirSync(join(out, 'runs'), { recursive: true });
      mkdirSync(join(out, 'blind'), { recursive: true });
      const cmd = [quote(codex), ...argv(lastFile, cwd, arm).map(quote)].join(' ');
      const r = spawnSync(cmd, { shell: true, input: promptFor(arm, c.q), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
      const jsonl = r.stdout ?? '';
      writeFileSync(join(out, 'runs', `${c.id}-${arm}.jsonl`), jsonl + (r.stderr ? `\n#stderr\n${r.stderr}` : ''));
      const last = existsSync(lastFile) ? readFileSync(lastFile, 'utf8') : '(no last message)';
      const s = summarise(jsonl, last);
      const key = randomBytes(4).toString('hex');
      writeFileSync(join(out, 'blind', `${key}.md`), `# ${key}\n\n**Question:** ${c.q}\n\n---\n\n${s.answer}\n`);
      const auto = autoChecks(s.answer, { allowedUrlPrefixes, fallback: arm === 'fallback', chat: arm === 'chat' });
      mapping.push({ key, case: c.id, set, arm, engine: 'codex', ...s, model: modelUsed, effort: effortUsed, memories_hidden: moved.includes(codexMemories), answer: undefined, auto });
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
  const COLS = 'key,B1,B2,B3,B4,B5,B6,B7,B8,B9,F1,F2,N1,N2,N3,L1,L2,journey1,journey2,journey3,journey4,journey5,journey6,category,notes';
  writeFileSync(join(out, 'scores.csv'), COLS + '\n' + mapping.map((m) => m.key).sort().map((k) => k + ','.repeat(COLS.split(',').length - 1) + '\n').join(''));
  console.log(`\n${out}\nGrade blind/ first (fill scores.csv, rubric.md), then open mapping.json.`);
}
