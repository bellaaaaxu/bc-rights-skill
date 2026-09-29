// skills/bc-unpaid-wages/scripts/status.mjs
// Prints, as JSON, what the skill must know before it answers. Maintenance is automatic: a weekly check compares every
// official source with what the reference files were written against, and nobody has to review anything. When a source
// changes, only the facts that rest on it stop (they are listed in `degraded` / `changed_sections`); the rest go on.
// If the automated check itself is more than fail_closed_after_days old, every statute-based rule stops (fail closed).
// When this environment is online, the latest check results are read from the project's GitHub, so an installed copy
// follows official changes without being reinstalled. Node 20+, no dependencies.
//   node scripts/status.mjs
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86_400_000;
const HERE = dirname(fileURLToPath(import.meta.url));
export const REMOTE_SOURCES = 'https://raw.githubusercontent.com/bellaaaaxu/bc-rights-skill/main/skills/bc-unpaid-wages/references/sources.json';
export const INSTALL_CANADA_LAW = 'npx https://github.com/bellaaaaxu/canada-law/releases/download/v0.2.3/canada-law-0.2.3.tgz install';
const days = (from, today) => Math.floor((today.getTime() - new Date(from).getTime()) / DAY);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Take the check results from the project's latest sources.json (fetched from GitHub) where they are newer than the
 * installed copy. A source whose baseline or phrases differ upstream means the reference files were rewritten there:
 * the installed wording may be out of date, so it is marked `updated_upstream` and treated as degraded.
 */
export function mergeRemote(local, remote) {
  if (!remote || !Array.isArray(remote.sources)) return { ...local, status_source: 'installed copy' };
  const byId = Object.fromEntries(remote.sources.map((r) => [r.id, r]));
  return {
    ...local,
    status_source: 'project on GitHub',
    sources: local.sources.map((s) => {
      const r = byId[s.id];
      if (!r || (r.last_checked ?? '') < (s.last_checked ?? '')) return s;
      const next = { ...s, status: r.status, last_checked: r.last_checked, last_ok: r.last_ok ?? s.last_ok, changed_sections: r.changed_sections ?? [] };
      if (!same(r.baseline, s.baseline) || !same(r.phrases, s.phrases)) next.updated_upstream = true;
      return next;
    }),
  };
}

// skillsRoot: the folder that holds this skill. Hosts that mount uploaded skills side by side (claude.ai, some
// agents) put canada-employment-law next to bc-unpaid-wages rather than under the home directory.
export function status(sources, today = new Date(), home = homedir(), skillsRoot = join(HERE, '..', '..')) {
  const grace = sources.unchecked_grace_days ?? 30;
  const checks = sources.sources.map((s) => s.last_checked).filter(Boolean).sort();
  const oldest = checks[0] ?? null;
  const age = oldest === null ? null : days(oldest, today);
  const tooOld = age === null || age > sources.fail_closed_after_days;
  // changed: the official source no longer matches what the reference files were written against.
  // not checked: the check has failed for longer than the grace period (one failed week is only a hiccup).
  // A statute source is held back section by section (changed_sections), not as a whole: one amended section must not
  // silence every rule from the same Act.
  const reason = (s) =>
    s.updated_upstream ? 'reference files updated in a newer version of this skill'
      : s.status === 'changed' && s.type === 'law' ? null
      : s.status === 'changed' ? 'official source changed'
        : s.status === 'error' && (!s.last_ok || days(s.last_ok, today) > grace) ? `not checked for more than ${grace} days`
          : null;
  const degraded = sources.sources.filter(reason).map((s) => ({ id: s.id, reason: reason(s), used_in: s.used_in }));
  const changedSections = sources.sources.flatMap((s) => (s.type === 'law' ? s.changed_sections ?? [] : []));
  const candidates = [
    join(home, '.agents', 'skills', 'canada-employment-law', 'scripts', 'bclaw.mjs'),
    join(home, '.claude', 'skills', 'canada-employment-law', 'scripts', 'bclaw.mjs'),
    join(skillsRoot, 'canada-employment-law', 'scripts', 'bclaw.mjs'),
  ];
  return {
    last_checked: oldest,
    days_since_checked: age,
    status_source: sources.status_source ?? 'installed copy',
    fail_closed_after_days: sources.fail_closed_after_days,
    fail_closed: tooOld,
    fail_closed_reason: tooOld
      ? `the automated check of the official sources is more than ${sources.fail_closed_after_days} days old (a threshold this project chose, not a legal rule)`
      : null,
    degraded,
    changed_sections: changedSections,
    unbaselined: sources.sources.filter((s) => s.status === 'new').map((s) => s.id),
    canada_law_script: candidates.find((p) => existsSync(p)) ?? null,
    install_canada_law: INSTALL_CANADA_LAW,
  };
}

/** The latest sources.json from GitHub, or null when offline, blocked or slow (3 s). BC_RIGHTS_OFFLINE=1 skips it. */
export async function fetchRemote(url = REMOTE_SOURCES, ms = 3000) {
  if (process.env.BC_RIGHTS_OFFLINE === '1') return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function currentStatus(skillDir = join(HERE, '..'), today = new Date()) {
  const local = JSON.parse(readFileSync(join(skillDir, 'references', 'sources.json'), 'utf8'));
  return status(mergeRemote(local, await fetchRemote()), today);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(await currentStatus(), null, 2));
}
