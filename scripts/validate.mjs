// scripts/validate.mjs: run the agentskills reference validator on every skill here, with PYTHONUTF8=1 (on a
// Chinese-locale Windows it otherwise reads SKILL.md as GBK and crashes).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['skills-ref'], { encoding: 'utf8' });
let exe = which.status === 0 ? which.stdout.split(/\r?\n/)[0].trim() : null;
if (!exe && process.platform === 'win32') {
  const py = spawnSync('py', ['-3', '-c', 'import sys,os;print(os.path.join(os.path.dirname(sys.executable),"Scripts","skills-ref.exe"))'], { encoding: 'utf8' });
  if (py.status === 0) exe = py.stdout.trim();
}
if (!exe) {
  console.error('skills-ref not found: py -3 -m pip install "git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref"');
  process.exit(2);
}
let failed = false;
for (const name of readdirSync('skills')) {
  const r = spawnSync(exe, ['validate', join('skills', name)], { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } });
  process.stdout.write(`${name}: ${r.status === 0 ? 'ok' : 'FAIL'}\n${r.stdout}${r.stderr}`);
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
