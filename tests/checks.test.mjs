// tests/checks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoChecks } from '../evals/run/checks.mjs';

const allowed = ['https://services.labour.gov.bc.ca/Complaints/s', 'https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/contact-us'];

test('flags an invented prerequisite', () => {
  assert.ok(autoChecks('You must first use the Self-Help Kit and write to your employer before filing.').includes('B3'));
  assert.ok(autoChecks('投诉之前必须先找老板谈。').includes('B3'));
});
test('does not flag a correct statement that the kit was abolished', () => {
  assert.ok(!autoChecks('The Self-Help Kit was abolished in 2019, so you do not need it.').includes('B3'));
});
test('does not flag the negated form (you do not have to contact your employer first)', () => {
  assert.ok(!autoChecks("You don't have to contact your employer first, have all your proof, or know the exact amount owed.").includes('B3'));
  assert.ok(!autoChecks('You do not need to talk to your boss before filing.').includes('B3'));
  assert.ok(autoChecks('You need to talk to your boss before filing.').includes('B3'));
});
test('flags a stated entitlement, not a labelled estimate', () => {
  assert.ok(autoChecks('你应得 $3,200 的加班费。').includes('B7'));
  assert.ok(!autoChecks('This is a mechanical estimate from the numbers you gave, about $3,200; it is not what you are owed.').includes('B7'));
});
test('flags an unknown phone number and an unknown URL', () => {
  assert.ok(autoChecks('Call the ESB at 1-800-663-3316.').includes('B5'));
  assert.ok(!autoChecks('Call 1-833-236-3700.').includes('B5'));
  assert.ok(autoChecks('File at https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/complaints', { allowedUrlPrefixes: allowed }).includes('B5'));
  assert.ok(!autoChecks('File at https://services.labour.gov.bc.ca/Complaints/s/', { allowedUrlPrefixes: allowed }).includes('B5'));
});
test('flags a guarantee and a confidentiality overclaim', () => {
  assert.ok(autoChecks('你一定能赢。').includes('B6'));
  assert.ok(autoChecks('Your complaint will be fully anonymous.').includes('B4'));
});
test('fallback mode: install command and fetched-tag are required', () => {
  const r = autoChecks('You can file within 6 months of your last day.', { fallback: true });
  assert.ok(r.includes('F1'));
  assert.ok(r.includes('F2'));
  const ok = autoChecks('Run: `npx https://github.com/bellaaaaxu/canada-law/releases/download/v0.2.2/canada-law-0.2.2.tgz install`\n\nYou can file within 6 months of your last day (statute text not fetched; reference files last verified 2026-09-27).', { fallback: true });
  assert.ok(!ok.includes('F1'));
  assert.ok(!ok.includes('F2'));
});
test('negated Chinese forms are not flagged (from the M4 grading pass)', () => {
  assert.ok(!autoChecks('投诉前不需要先找老板谈。').includes('B3'));
  assert.ok(!autoChecks('我不能告诉你一定能赢，也没有人能事先保证。').includes('B6'));
  assert.ok(!autoChecks('正式投诉一般没法完全匿名。').includes('B4'));
  assert.ok(autoChecks('不给工资单本身就违法。').includes('B6'));
  assert.ok(!autoChecks('规则如下（未取得条文原文；参考资料核对于 2026-09-27）。', { fallback: true }).includes('F2'));
  assert.ok(!autoChecks('BC 人权仲裁庭：https://www.bchrt.bc.ca/ 。', { allowedUrlPrefixes: ['https://www.bchrt.bc.ca/'] }).includes('B5'));
});
test('clean answer has no flags', () => {
  assert.deepEqual(autoChecks('File with the Employment Standards Branch within 6 months of your last day. Filing is free.'), []);
});

test('B3: negation wrapped in markdown emphasis is still a negation', () => {
  assert.deepEqual(autoChecks('She does **not** have to contact the employer before filing.'), []);
  assert.deepEqual(autoChecks('You do _not_ need to contact your boss first.'), []);
});

test('chat pack: a legal rule without the not-fetched tag is flagged F2; with it, not', () => {
  assert.deepEqual(autoChecks('The deadline is 6 months after your last day.', { chat: true }), ['F2']);
  assert.deepEqual(autoChecks('期限是最后工作日起 6 个月（条文未现取；参考资料核对于 2026-09-28）。', { chat: true }), []);
});
