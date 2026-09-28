// tests/tally.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, tally, render } from '../evals/run/tally.mjs';

const mapping = [
  { key: 'a1', case: 'p01-zh', set: 'procedure', arm: 'bare', skill_used: false, law_fetched: false, web_used: true, cost_usd: 0.1, auto: ['B3'] },
  { key: 'a2', case: 'p01-zh', set: 'procedure', arm: 'skill', skill_used: true, law_fetched: true, web_used: false, cost_usd: 0.2, auto: [] },
  { key: 'a3', case: 'j01-zh', set: 'journey', arm: 'skill', skill_used: true, law_fetched: false, web_used: false, cost_usd: 0.2, auto: [] },
  { key: 'a4', case: 'p01-zh', set: 'procedure', arm: 'fallback', skill_used: true, law_fetched: false, web_used: false, cost_usd: 0.1, auto: ['F1'] },
];
const csv = `key,B1,B2,B3,B4,B5,B6,B7,B8,F1,F2,N1,N2,N3,journey1,journey2,journey3,journey4,journey5,journey6,category,notes
a1,1,,1,,,,,,,,1,,,,,,,,,process,said self-help kit
a2,,,,,,,,,,,,,,,,,,,,,
a3,,,,,,,,,,,,,,1,1,1,0,1,1,,
a4,,,,,,,,,1,,,,,,,,,,,,`;

test('counts blocking errors per arm and answers with any blocking error', () => {
  const t = tally(mapping, parseCsv(csv));
  assert.equal(t.bare.blocking.B1, 1);
  assert.equal(t.bare.blocking.B3, 1);
  assert.equal(t.bare.answers_with_blocking, 1);
  assert.equal(t.skill.answers_with_blocking, 0);
  assert.equal(t.bare.non_blocking.N1, 1);
});

test('fallback requirements only for the fallback arm', () => {
  const t = tally(mapping, parseCsv(csv));
  assert.equal(t.fallback.fallback.F1, 1);
  assert.equal(t.fallback.fallback.F2, 0);
  assert.equal(t.skill.fallback, null);
});

test('journey behaviours are counted only over journey answers', () => {
  const t = tally(mapping, parseCsv(csv));
  assert.equal(t.skill.journey_answers, 1);
  assert.deepEqual(t.skill.journey_shown, { journey1: 1, journey2: 1, journey3: 1, journey4: 0, journey5: 1, journey6: 1 });
});

test('renders a markdown table with one column per arm and never the word significant', () => {
  const md = render(tally(mapping, parseCsv(csv)));
  assert.match(md, /\| \| bare \| skill \| fallback \|/);
  assert.doesNotMatch(md, /significant/i);
  assert.match(md, /cost USD \| 0\.10 \| 0\.40 \| 0\.10/);
});
