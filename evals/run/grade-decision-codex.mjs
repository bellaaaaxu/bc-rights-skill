// evals/run/grade-decision-codex.mjs: have Codex grade every decision-set grading pack it has not graded yet.
//   node evals/run/grade-decision-codex.mjs [--only <case-id>] [--dry-run]
// Finds .local/eval-runs/*/decision/*/grading-pack.md, sends each to `codex exec` on stdin, writes codex-grade.md beside it.
// Uses the tester's ChatGPT plan. Sequential.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const only = opt('--only');
const dry = args.includes('--dry-run');
const root = fileURLToPath(new URL('../../', import.meta.url));
const runs = join(root, '.local', 'eval-runs');
const codex = process.env.CODEX_BIN ?? (process.platform === 'win32' ? join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm', 'codex.cmd') : 'codex');
const quote = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

const packs = [];
for (const r of readdirSync(runs)) {
  const d = join(runs, r, 'decision');
  if (!existsSync(d) || !statSync(d).isDirectory()) continue;
  for (const c of readdirSync(d)) {
    const p = join(d, c, 'grading-pack.md');
    if (existsSync(p) && (!only || c === only)) packs.push({ caseId: c, dir: join(d, c), pack: p });
  }
}
console.log(`${packs.length} pack(s)`);
const cwd = join(root, '.eval-tmp', 'codex-grader');
mkdirSync(cwd, { recursive: true });
const HEAD = `你是打分者。下面是一份「裁决集打分包」：先是给打分者的规矩，然后是帮手看到的叙述、对话、帮手写的材料包，最后是答案卷。请严格按规矩打分，输出：一张表（代号 | 有无 | 依据在材料包或对话的哪一处），一段「漏了什么、错了什么」，再一段逐条对照答案卷里「理想的帮手应该问到 / 找到的」（找到 / 漏了 / 部分），最后一句总评。不要客气，不要泛泛表扬。只用打分包里的内容，不要上网，不要读别的文件。\n\n`;
// Hide Codex's own memory folder while grading (the desktop app writes it from imported sessions; the grader must
// see only the pack). Moved to ~/.hidden-by-eval/memories and restored in `finally`.
const codexMemories = join(homedir(), '.codex', 'memories');
const parked = join(homedir(), '.hidden-by-eval', 'memories');
let memoriesMoved = false;
if (!dry && existsSync(codexMemories)) { mkdirSync(join(parked, '..'), { recursive: true }); renameSync(codexMemories, parked); memoriesMoved = true; }
try {
for (const p of packs) {
  const outFile = join(p.dir, 'codex-grade.md');
  if (existsSync(outFile)) { console.log(`${p.caseId}: already graded`); continue; }
  const lastFile = join(p.dir, 'codex-grade.last.md');
  const argv = ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-o', lastFile, '-C', cwd, '-'];
  if (dry) { console.log(`${p.caseId}: codex ${argv.join(' ')} <<< pack (${statSync(p.pack).size} bytes)`); continue; }
  const cmd = [quote(codex), ...argv.map(quote)].join(' ');
  const r = spawnSync(cmd, { shell: true, input: HEAD + readFileSync(p.pack, 'utf8'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
  const grade = existsSync(lastFile) ? readFileSync(lastFile, 'utf8') : '';
  if (grade.trim()) {
    writeFileSync(outFile, `# Codex 打分 · ${p.caseId}\n\n${grade}\n`);
    console.log(`${p.caseId}: graded (${grade.length} chars)`);
  } else {
    writeFileSync(join(p.dir, 'codex-grade.error.txt'), `${r.stdout ?? ''}\n#stderr\n${r.stderr ?? ''}`);
    console.log(`${p.caseId}: NO GRADE (see codex-grade.error.txt)`);
  }
}
} finally {
  if (memoriesMoved && existsSync(parked)) renameSync(parked, codexMemories);
}
