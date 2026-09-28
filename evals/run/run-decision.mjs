// evals/run/run-decision.mjs: one decision-set case, played out between two Claude processes.
//   node evals/run/run-decision.mjs --case 2024-BCEST-12 [--max-turns 12] [--model <m>] [--dry-run]
// Helper  = `claude -p` in a project that holds bc-unpaid-wages + canada-employment-law; the same session is resumed each turn.
// Player  = `claude -p` with no tools, given facts.md as its system prompt and the transcript so far; answers only what was asked.
// Stops when the helper's message contains a "材料包" heading or after --max-turns. Writes
// .local/eval-runs/<time>/decision/<case>/{transcript.md,package.md,hashes.txt}. The grader opens answer-key.md only after that.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findClaude } from './find-claude.mjs';

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const caseId = opt('--case');
const maxTurns = Number(opt('--max-turns') ?? 12);
const model = opt('--model');
const dry = args.includes('--dry-run');
if (!caseId) { console.error('--case <folder under evals/decision>'); process.exit(2); }

const root = fileURLToPath(new URL('../../', import.meta.url));
const caseDir = join(root, 'evals', 'decision', caseId);
const narrative = readFileSync(join(caseDir, 'narrative.md'), 'utf8');
const facts = readFileSync(join(caseDir, 'facts.md'), 'utf8');
const todayLine = narrative.split('\n').find((l) => l.startsWith('今天：')) ?? '';
const today = todayLine.replace('今天：', '').trim() || new Date().toLocaleDateString('en-CA');
const claude = findClaude();
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const out = join(root, '.local', 'eval-runs', stamp, 'decision', caseId);

// helper project
const helperDir = join(root, '.eval-tmp', `decision-${caseId}`);
rmSync(helperDir, { recursive: true, force: true });
mkdirSync(join(helperDir, '.claude', 'skills'), { recursive: true });
cpSync(join(root, 'skills', 'bc-unpaid-wages'), join(helperDir, '.claude', 'skills', 'bc-unpaid-wages'), { recursive: true });
const canadaLawHome = join(homedir(), '.claude', 'skills', 'canada-employment-law');
if (!existsSync(canadaLawHome)) { console.error(`needs ${canadaLawHome}`); process.exit(2); }
cpSync(canadaLawHome, join(helperDir, '.claude', 'skills', 'canada-employment-law'), { recursive: true });
const playerDir = join(root, '.eval-tmp', `decision-${caseId}-player`);
rmSync(playerDir, { recursive: true, force: true });
mkdirSync(join(playerDir, '.claude'), { recursive: true });

const HELPER_SYSTEM = `You are an AI assistant. Today's date is ${today}. Use the tools and skills you have when they would make your answer more accurate or more up to date. The person you are talking to is a worker in British Columbia who thinks their employer owes them money. Help them, in their language, one round of questions at a time; when you have enough, write the facts package.`;
const PLAYER_SYSTEM = `你在扮演一个 BC 的打工人，正在和一个帮手聊天。下面是你的事实卡；照卡回答。规矩：只回答帮手问到的，不主动把整张卡倒出来；卡里没有的事一律说「不记得」或「不知道」，不要编；你不懂法律，说不出条文，也判断不了帮手算的数对不对；用普通打工人的口吻，可以有情绪，但不要加新事实。帮手如果一次问了好几个问题，就逐个回答问到的。今天是 ${today}。\n\n=== 事实卡 ===\n${facts}`;

function run(argv, cwd) {
  const r = spawnSync(claude, argv, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
  const j = (() => { try { return JSON.parse(r.stdout); } catch { return null; } })();
  return { text: j?.result ?? '', session: j?.session_id ?? null, cost: j?.total_cost_usd ?? 0, raw: r.stdout, err: r.stderr };
}
const helperArgv = (msg, session) => ['-p', msg, '--system-prompt', HELPER_SYSTEM, '--setting-sources', 'project', '--strict-mcp-config', '--tools', 'Bash,Read,Glob,Grep,Skill', '--allowedTools', 'Bash(node *)', 'Read', 'Glob', 'Grep', 'Skill', '--max-budget-usd', '3', '--output-format', 'json', ...(session ? ['--resume', session] : []), ...(model ? ['--model', model] : [])];
const playerArgv = (msg) => ['-p', msg, '--system-prompt', PLAYER_SYSTEM, '--setting-sources', 'project', '--strict-mcp-config', '--tools', '', '--no-session-persistence', '--max-budget-usd', '1', '--output-format', 'json', ...(model ? ['--model', model] : [])];

if (dry) {
  console.log(`case ${caseId}, today ${today}, max ${maxTurns} turns, claude binary ${claude}`);
  console.log(`helper: claude ${helperArgv('<narrative>', null).map((a) => JSON.stringify(a)).join(' ')}`);
  console.log(`player: claude ${playerArgv('<transcript + last helper message>').map((a) => JSON.stringify(a)).join(' ')}`);
  process.exit(0);
}

mkdirSync(out, { recursive: true });
const transcript = [];
let session = null;
let cost = 0;
let helperMsg = narrative.split('\n').filter((l) => !l.startsWith('今天：')).join('\n').trim();
let packageText = null;
for (let t = 1; t <= maxTurns; t++) {
  const h = run(helperArgv(helperMsg, session), helperDir);
  session = h.session ?? session;
  cost += h.cost;
  transcript.push({ role: '当事人', text: helperMsg }, { role: '帮手', text: h.text });
  writeFileSync(join(out, `helper-${t}.json`), h.raw);
  console.log(`turn ${t}: helper ${h.text.length} chars, $${cost.toFixed(2)}`);
  if (/^#+\s*材料包|材料包：/m.test(h.text) || !h.text) { packageText = h.text; break; }
  const history = transcript.map((m) => `【${m.role}】\n${m.text}`).join('\n\n');
  const p = run(playerArgv(`到目前为止的对话：\n\n${history}\n\n帮手刚才说的话在最后。你现在怎么回答？只答问到的。`), playerDir);
  cost += p.cost;
  helperMsg = p.text || '我不知道。';
}
writeFileSync(join(out, 'transcript.md'), transcript.map((m) => `## ${m.role}\n\n${m.text}\n`).join('\n'));
if (packageText) {
  writeFileSync(join(out, 'package.md'), packageText);
  const h = createHash('sha256').update(packageText).digest('hex');
  writeFileSync(join(out, 'hashes.txt'), `${h}  package.md\n`);
  console.log(`package written, sha256 ${h}`);
} else {
  console.log('no package produced within max turns (transcript saved)');
}
console.log(`total $${cost.toFixed(2)} -> ${out}\nNow grade against evals/decision/${caseId}/answer-key.md (open it only now).`);
