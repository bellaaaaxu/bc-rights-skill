// skills/bc-unpaid-wages/scripts/status.mjs
// Prints, as JSON, what the skill must know before it answers: how old the human verification of the reference
// files is, whether that means "fail closed" for statute-based answers, which sources are flagged by the weekly
// check, and whether the canada-law script is installed. Node 20+, no dependencies.
//   node scripts/status.mjs
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86_400_000;

const HERE = dirname(fileURLToPath(import.meta.url));

// skillsRoot: the folder that holds this skill. Hosts that mount uploaded skills side by side (claude.ai, some
// agents) put canada-employment-law next to bc-unpaid-wages rather than under the home directory.
export function status(sources, today = new Date(), home = homedir(), skillsRoot = join(HERE, '..', '..')) {
  const dates = sources.sources.map((s) => s.last_human_verified).filter(Boolean).sort();
  const oldest = dates[0] ?? null;
  const days = oldest === null ? null : Math.floor((today.getTime() - new Date(oldest).getTime()) / DAY);
  // 'changed' and 'error' mean a person has to look again; 'new' only means the automated check has no baseline yet.
  const isFlag = (s) => s.status === 'changed' || s.status === 'error';
  const flagged = sources.sources.filter(isFlag).map((s) => ({ id: s.id, status: s.status, used_in: s.used_in }));
  const unbaselined = sources.sources.filter((s) => s.status === 'new').map((s) => s.id);
  const lawFlagged = sources.sources.some((s) => s.type === 'law' && isFlag(s));
  const tooOld = days === null || days > sources.fail_closed_after_days;
  const candidates = [
    join(home, '.agents', 'skills', 'canada-employment-law', 'scripts', 'bclaw.mjs'),
    join(home, '.claude', 'skills', 'canada-employment-law', 'scripts', 'bclaw.mjs'),
    join(skillsRoot, 'canada-employment-law', 'scripts', 'bclaw.mjs'),
  ];
  return {
    last_human_verified: oldest,
    days_since_human_verified: days,
    fail_closed_after_days: sources.fail_closed_after_days,
    fail_closed: tooOld || lawFlagged,
    fail_closed_reason: tooOld
      ? `human verification older than ${sources.fail_closed_after_days} days (a threshold this project chose, not a legal rule)`
      : lawFlagged
        ? 'a statute source is flagged as possibly changed and not yet re-verified'
        : null,
    flagged,
    unbaselined,
    canada_law_script: candidates.find((p) => existsSync(p)) ?? null,
    install_canada_law: 'npx https://github.com/bellaaaaxu/canada-law/releases/download/v0.2.2/canada-law-0.2.2.tgz install',
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sources = JSON.parse(readFileSync(join(HERE, '..', 'references', 'sources.json'), 'utf8'));
  console.log(JSON.stringify(status(sources), null, 2));
}
