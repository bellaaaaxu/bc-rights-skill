// evals/run/tally.mjs: raw counts per arm from a graded run folder.
//   node evals/run/tally.mjs <run-folder>          (folder holding mapping.json and the filled scores.csv)
// scores.csv columns: key,B1..B9,F1,F2,N1..N3,L1,L2,journey1..6,category,notes (older files lack B9/L1/L2) ; a cell with any non-empty value counts as "flagged"
// (journey columns: 1 = behaviour shown, blank/0 = not shown). Prints a markdown table; never says "significant".
import { existsSync, readFileSync } from 'node:fs';
import { replyLength } from './checks.mjs';
import { join } from 'node:path';

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const cols = lines[0].split(',');
  return lines.slice(1).filter((l) => l.trim()).map((l) => {
    const cells = l.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? '').trim()]));
  });
}

export function tally(mapping, scores, lengths = {}) {
  const byKey = Object.fromEntries(scores.map((s) => [s.key, s]));
  const arms = [...new Set(mapping.map((m) => m.arm))];
  const blocking = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'];
  const fallback = ['F1', 'F2'];
  const nonBlocking = ['N1', 'N2', 'N3', 'L1', 'L2'];
  const journey = ['journey1', 'journey2', 'journey3', 'journey4', 'journey5', 'journey6'];
  const out = {};
  for (const arm of arms) {
    const rows = mapping.filter((m) => m.arm === arm).map((m) => ({ m, s: byKey[m.key] }));
    const graded = rows.filter((r) => r.s);
    const count = (codes) => Object.fromEntries(codes.map((c) => [c, graded.filter((r) => r.s[c] && r.s[c] !== '0').length]));
    const answersWithBlocking = graded.filter((r) => blocking.some((c) => r.s[c] && r.s[c] !== '0')).length;
    const journeyRows = graded.filter((r) => r.m.set?.startsWith('journey'));
    out[arm] = {
      answers: rows.length,
      graded: graded.length,
      blocking: count(blocking),
      answers_with_blocking: answersWithBlocking,
      fallback: arm === 'fallback' ? count(fallback) : null,
      non_blocking: count(nonBlocking),
      journey_shown: journeyRows.length ? Object.fromEntries(journey.map((j) => [j, journeyRows.filter((r) => r.s[j] === '1').length])) : null,
      journey_answers: journeyRows.length,
      skill_used: rows.filter((r) => r.m.skill_used).length,
      law_fetched: rows.filter((r) => r.m.law_fetched).length,
      web_used: rows.filter((r) => r.m.web_used).length,
      cost_usd: rows.reduce((n, r) => n + (r.m.cost_usd ?? 0), 0),
      auto_flags: rows.reduce((n, r) => n + (r.m.auto?.length ?? 0), 0),
      length: (() => {
        const L = rows.map((r) => lengths[r.m.key]).filter(Boolean);
        if (!L.length) return null;
        const units = L.map((x) => (x.cjk >= x.words ? x.cjk : x.words)).sort((a, b) => a - b);
        return { median: units[Math.floor((units.length - 1) / 2)], max: units[units.length - 1], over: L.filter((x) => x.over).length, n: L.length };
      })(),
    };
  }
  return out;
}

export function render(t) {
  const arms = Object.keys(t);
  const line = (label, f) => `| ${label} | ${arms.map((a) => f(t[a])).join(' | ')} |`;
  const rows = [
    `| | ${arms.join(' | ')} |`,
    `|---|${arms.map(() => '---').join('|')}|`,
    line('answers (graded)', (x) => `${x.answers} (${x.graded})`),
    line('answers with any blocking error', (x) => x.answers_with_blocking),
    ...['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'].map((c) => line(c, (x) => x.blocking[c])),
    line('F1 / F2 (fallback only)', (x) => (x.fallback ? `${x.fallback.F1} / ${x.fallback.F2}` : '-')),
    ...['N1', 'N2', 'N3', 'L1', 'L2'].map((c) => line(c, (x) => x.non_blocking[c])),
    line('reply length: median / max (Chinese chars or English words; auto) / over target', (x) => (x.length ? `${x.length.median} / ${x.length.max} / ${x.length.over} of ${x.length.n}` : '-')),
    line('journey behaviours shown (of answers)', (x) => (x.journey_shown ? Object.values(x.journey_shown).map((n) => `${n}/${x.journey_answers}`).join(' ') : '-')),
    line('skill used / law fetched / web used', (x) => `${x.skill_used} / ${x.law_fetched} / ${x.web_used}`),
    line('auto flags (hints)', (x) => x.auto_flags),
    line('cost USD', (x) => x.cost_usd.toFixed(2)),
  ];
  return rows.join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('tally.mjs')) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node evals/run/tally.mjs <run-folder>'); process.exit(2); }
  const mapping = JSON.parse(readFileSync(join(dir, 'mapping.json'), 'utf8'));
  const scores = parseCsv(readFileSync(join(dir, 'scores.csv'), 'utf8'));
  const lengths = {};
  for (const m of mapping) {
    const f = join(dir, 'blind', `${m.key}.md`);
    if (!existsSync(f)) continue;
    const s = readFileSync(f, 'utf8');
    lengths[m.key] = replyLength(s.slice(s.indexOf('\n---\n') + 5)); // blind files: question, then "---", then the answer
  }
  console.log(render(tally(mapping, scores, lengths)));
}
