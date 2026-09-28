// tests/status.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '../skills/bc-unpaid-wages/scripts/status.mjs';

const src = (over = {}) => ({
  fail_closed_after_days: 180,
  sources: [
    { id: 'a', type: 'phrases', used_in: ['01'], last_human_verified: '2026-01-01', status: 'ok', ...over.a },
    { id: 'laws', type: 'law', used_in: ['01'], last_human_verified: '2026-01-01', status: 'ok', ...over.laws },
  ],
});
const home = 'C:/nonexistent-home';

test('180 days after human verification is still open', () => {
  const s = status(src(), new Date('2026-06-30'), home); // 180 days after 2026-01-01
  assert.equal(s.days_since_human_verified, 180);
  assert.equal(s.fail_closed, false);
});

test('181 days after human verification is fail closed even when status is ok and last_checked is today', () => {
  const s = status(src({ a: { last_checked: '2026-07-01' }, laws: { last_checked: '2026-07-01' } }), new Date('2026-07-01'), home);
  assert.equal(s.days_since_human_verified, 181);
  assert.equal(s.fail_closed, true);
});

test('a flagged law source is fail closed; a flagged page source is only listed', () => {
  assert.equal(status(src({ laws: { status: 'changed' } }), new Date('2026-02-01'), home).fail_closed, true);
  const s = status(src({ a: { status: 'changed' } }), new Date('2026-02-01'), home);
  assert.equal(s.fail_closed, false);
  assert.deepEqual(s.flagged, [{ id: 'a', status: 'changed', used_in: ['01'] }]);
});

test('the oldest human verification date counts', () => {
  const s = status(src({ a: { last_human_verified: '2025-01-01' } }), new Date('2026-02-01'), home);
  assert.equal(s.last_human_verified, '2025-01-01');
  assert.equal(s.fail_closed, true);
});

test('reports whether the canada-law script exists under the given home', () => {
  assert.equal(status(src(), new Date('2026-02-01'), home).canada_law_script, null);
});
