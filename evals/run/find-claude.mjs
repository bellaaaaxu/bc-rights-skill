// evals/run/find-claude.mjs: which `claude` binary to run the evals with.
// Order: CLAUDE_BIN, then the newest Claude Code bundled with the Claude desktop app (it is newer than the native
// installer's copy on this machine: 2.1.281 vs 2.1.81, and only 2.1.280+ can use Opus 5.5), then ~/.local/bin.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const bundled = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Claude', 'claude-code');
  if (existsSync(bundled)) {
    const versions = readdirSync(bundled).filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const v of versions.reverse()) {
      const exe = join(bundled, v, process.platform === 'win32' ? 'claude.exe' : 'claude');
      if (existsSync(exe)) return exe;
    }
  }
  const native = join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  return existsSync(native) ? native : 'claude';
}
