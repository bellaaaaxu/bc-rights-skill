// tests/status.test.mjs
// Maintenance is automatic (decided 2026-09-29): no human review clock. A changed or long-unchecked source stops only
// the facts that rest on it; a stale automated check (over fail_closed_after_days) stops every statute-based rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { status, mergeRemote, fetchRemote } from '../skills/bc-unpaid-wages/scripts/status.mjs';

const src = (over = {}) => ({
  fail_closed_after_days: 180,
  unchecked_grace_days: 30,
  sources: [
    { id: 'a', type: 'phrases', phrases: ['x'], used_in: ['01'], last_checked: '2026-01-01', last_ok: '2026-01-01', status: 'ok', ...over.a },
    { id: 'laws', type: 'law', used_in: ['01'], baseline: { k: 1 }, last_checked: '2026-01-01', last_ok: '2026-01-01', status: 'ok', changed_sections: [], ...over.laws },
  ],
});
const home = 'C:/nonexistent-home';
const root = 'C:/nonexistent-skills-root';
const at = (d) => new Date(d);

test('180 days after the last automated check is still open', () => {
  const s = status(src(), at('2026-06-30'), home, root); // 180 days after 2026-01-01
  assert.equal(s.days_since_checked, 180);
  assert.equal(s.fail_closed, false);
});

test('181 days after the last automated check is fail closed (the weekly check stopped, or an old offline copy)', () => {
  const s = status(src(), at('2026-07-01'), home, root);
  assert.equal(s.days_since_checked, 181);
  assert.equal(s.fail_closed, true);
  assert.match(s.fail_closed_reason, /automated check/);
});

test('a changed source is degraded, and only that one; nothing fails closed', () => {
  const s = status(src({ a: { status: 'changed' } }), at('2026-02-01'), home, root);
  assert.equal(s.fail_closed, false);
  assert.deepEqual(s.degraded, [{ id: 'a', reason: 'official source changed', used_in: ['01'] }]);
});

test('changed statute sections are listed one by one, so only those rules stop, not the whole Act', () => {
  const s = status(src({ laws: { status: 'changed', changed_sections: ['96113_01 s.74'] } }), at('2026-02-01'), home, root);
  assert.equal(s.fail_closed, false);
  assert.deepEqual(s.changed_sections, ['96113_01 s.74']);
  assert.deepEqual(s.degraded, []);
});

test('a statute source that could not be checked for a month is held back as a whole', () => {
  const s = status(src({ laws: { status: 'error', last_checked: '2026-03-01', last_ok: '2026-01-01' } }), at('2026-03-01'), home, root);
  assert.equal(s.degraded[0].id, 'laws');
});

test('one failed weekly check is a hiccup; failing for more than 30 days degrades the source', () => {
  const one = status(src({ a: { status: 'error', last_checked: '2026-02-01', last_ok: '2026-01-25' } }), at('2026-02-01'), home, root);
  assert.deepEqual(one.degraded, []);
  const long = status(src({ a: { status: 'error', last_checked: '2026-03-01', last_ok: '2026-01-25' } }), at('2026-03-01'), home, root);
  assert.equal(long.degraded[0].reason, 'not checked for more than 30 days');
});

test('a source with no baseline yet is listed as unbaselined, not degraded', () => {
  const s = status(src({ laws: { status: 'new' } }), at('2026-02-01'), home, root);
  assert.deepEqual(s.degraded, []);
  assert.deepEqual(s.unbaselined, ['laws']);
});

test('mergeRemote takes newer check results from GitHub', () => {
  const local = src();
  const remote = { sources: [{ id: 'a', phrases: ['x'], status: 'changed', last_checked: '2026-03-01', last_ok: '2026-02-20' }, { id: 'laws', baseline: { k: 1 }, status: 'ok', last_checked: '2026-03-01', last_ok: '2026-03-01', changed_sections: [] }] };
  const m = mergeRemote(local, remote);
  assert.equal(m.status_source, 'project on GitHub');
  const s = status(m, at('2026-03-02'), home, root);
  assert.equal(s.last_checked, '2026-03-01');
  assert.deepEqual(s.degraded.map((d) => d.id), ['a']);
});

test('mergeRemote marks a source whose baseline was replaced upstream: the installed wording may be out of date', () => {
  const remote = { sources: [{ id: 'laws', baseline: { k: 2 }, status: 'ok', last_checked: '2026-03-01', last_ok: '2026-03-01', changed_sections: [] }] };
  const s = status(mergeRemote(src(), remote), at('2026-03-02'), home, root);
  assert.equal(s.degraded[0].id, 'laws');
  assert.match(s.degraded[0].reason, /newer version/);
});

test('mergeRemote ignores older remote results and missing remote data', () => {
  const remote = { sources: [{ id: 'a', phrases: ['x'], status: 'changed', last_checked: '2025-12-01' }] };
  assert.deepEqual(status(mergeRemote(src(), remote), at('2026-02-01'), home, root).degraded, []);
  assert.equal(mergeRemote(src(), null).status_source, 'installed copy');
});

test('fetchRemote gives null when offline (BC_RIGHTS_OFFLINE=1) instead of throwing', async () => {
  process.env.BC_RIGHTS_OFFLINE = '1';
  try {
    assert.equal(await fetchRemote(), null);
  } finally {
    delete process.env.BC_RIGHTS_OFFLINE;
  }
});

test('fetchRemote gives null for an unreachable address within the timeout', async () => {
  assert.equal(await fetchRemote('http://127.0.0.1:9/sources.json', 1500), null);
});

test('reports whether the canada-law script exists under the given home', () => {
  assert.equal(status(src(), at('2026-02-01'), home, root).canada_law_script, null);
});

test('finds canada-law installed next to this skill (hosts that mount uploaded skills side by side)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skills-root-'));
  try {
    const script = join(dir, 'canada-employment-law', 'scripts', 'bclaw.mjs');
    mkdirSync(dirname(script), { recursive: true });
    writeFileSync(script, '// stub');
    assert.equal(status(src(), at('2026-02-01'), home, dir).canada_law_script, script);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the install command points at canada-law 0.2.3', () => {
  assert.match(status(src(), at('2026-02-01'), home, root).install_canada_law, /v0\.2\.3\/canada-law-0\.2\.3\.tgz install$/);
});
