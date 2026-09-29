// tests/check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, applyResults, withRetry, due } from '../scripts/lib/check.mjs';

const today = '2026-10-05';
const sources = () => ({
  fail_closed_after_days: 180,
  sources: [
    { id: 'p', type: 'phrases', url: 'u1', phrases: ['within 6 months', 'no fee'], used_in: ['01'], baseline: null, last_checked: null, last_human_verified: '2026-09-27', status: 'ok' },
    { id: 'h', type: 'hash', url: 'u2', used_in: ['05'], baseline: 'abc', last_checked: null, last_human_verified: '2026-09-27', status: 'ok' },
    { id: 'r', type: 'reachable', url: 'u3', used_in: ['01'], baseline: null, last_checked: null, last_human_verified: '2026-09-27', status: 'ok' },
    { id: 'laws', type: 'law', sections: [['96113_01', '74']], used_in: ['01'], baseline: { '96113_01:74': 'old' }, last_checked: null, last_human_verified: '2026-09-27', status: 'ok' },
  ],
});
const io = (over = {}) => ({
  get: async (url) => ({ u1: 'Complaints must be filed within 6 months. There is no fee.', u2: 'FILE', u3: 'ok' }[url] ?? (() => { throw new Error('HTTP 404'); })()),
  sha: (s) => (s === 'FILE' ? 'abc' : 'law-' + s),
  law: async () => ({ text: 'same', current_to: '2026-09-22' }),
  ...over,
});

test('everything unchanged: all ok', async () => {
  const r = await evaluate(sources(), io({ sha: (s) => (s === 'FILE' ? 'abc' : 'old') }));
  assert.deepEqual(r.map((x) => x.status), ['ok', 'ok', 'ok', 'ok']);
});

test('a missing phrase, a changed file, an unreachable page and a changed section are each flagged', async () => {
  const r = await evaluate(sources(), io({
    get: async (url) => ({ u1: 'Complaints must be filed within 12 months.', u2: 'OTHER' }[url] ?? (() => { throw new Error('HTTP 500'); })()),
  }));
  assert.deepEqual(r.map((x) => x.status), ['changed', 'changed', 'error', 'changed']);
  assert.match(r[0].detail, /no fee/);
});

test('applyResults moves last_checked on every run, and last_human_verified plus baseline only on accept', async () => {
  const src = sources();
  const results = await evaluate(src, io());
  const plain = applyResults(src, results, today, false);
  assert.equal(plain.sources[1].last_checked, today);
  assert.equal(plain.sources[1].last_human_verified, '2026-09-27');
  assert.equal(plain.sources[3].status, 'changed');
  assert.deepEqual(plain.sources[3].baseline, { '96113_01:74': 'old' });
  const accepted = applyResults(src, results, today, true);
  assert.equal(accepted.sources[3].last_human_verified, today);
  assert.equal(accepted.sources[3].status, 'ok');
  assert.deepEqual(accepted.sources[3].baseline, { '96113_01:74': 'law-same' });
});

test('an error is never accepted as verified', async () => {
  const src = sources();
  const results = await evaluate(src, io({ get: async () => { throw new Error('HTTP 500'); } }));
  const accepted = applyResults(src, results, today, true);
  assert.equal(accepted.sources[0].status, 'error');
  assert.equal(accepted.sources[0].last_human_verified, '2026-09-27');
});

test('automatic maintenance: a run records last_ok, keeps the old last_ok on a failed check, and lists changed sections', async () => {
  const src = sources();
  src.sources[0].last_ok = '2026-09-01';
  const results = await evaluate(src, io({
    get: async (url) => ({ u1: 'Complaints must be filed within 6 months. There is no fee.', u2: 'FILE' }[url] ?? (() => { throw new Error('HTTP 500'); })()),
    law: async () => ({ text: 'new text', current_to: '2026-10-01' }),
  }));
  const next = applyResults(src, results, today, false);
  const byId = Object.fromEntries(next.sources.map((s) => [s.id, s]));
  assert.equal(byId.p.last_ok, today);
  assert.equal(byId.r.status, 'error');
  assert.equal(byId.r.last_ok, undefined); // never ok before, so nothing to keep
  assert.equal(byId.laws.status, 'changed');
  assert.deepEqual(byId.laws.changed_sections, ['96113_01 s.74']);
});

test('accept (optional maintainer review) clears changed sections and sets a new baseline', async () => {
  const src = sources();
  const results = await evaluate(src, io({ law: async () => ({ text: 'new text', current_to: '2026-10-01' }) }));
  const next = applyResults(src, results, today, true);
  const laws = next.sources.find((s) => s.id === 'laws');
  assert.equal(laws.status, 'ok');
  assert.deepEqual(laws.changed_sections, []);
  assert.equal(laws.last_human_verified, today);
});

test('withRetry tries again after a refused request, but not after a missing page', async () => {
  const waits = [];
  const sleep = async (ms) => { waits.push(ms); };
  let n = 0;
  const flaky = async () => { n += 1; if (n < 3) throw new Error('fetch failed'); return 'page'; };
  assert.equal(await withRetry(flaky, [10, 30], sleep), 'page');
  assert.deepEqual(waits, [10, 30]);

  await assert.rejects(withRetry(async () => { throw new Error('fetch failed'); }, [10, 30], sleep), /fetch failed/);
  waits.length = 0;
  await assert.rejects(withRetry(async () => { throw new Error('HTTP 404'); }, [10, 30], sleep), /HTTP 404/);
  assert.deepEqual(waits, []);
});

test('due: the daily run checks a week after the last check, or the next day after a source could not be reached', () => {
  const s = (over = {}) => ({ sources: [{ id: 'a', last_checked: '2026-10-01', status: 'ok' }, { id: 'b', last_checked: '2026-10-01', status: 'ok', ...over }] });
  assert.equal(due(s(), '2026-10-07'), false);
  assert.equal(due(s(), '2026-10-08'), true);
  assert.equal(due(s({ status: 'error' }), '2026-10-02'), true);
  assert.equal(due(s({ last_checked: null }), '2026-10-02'), true);
});
