// tests/references.test.mjs: structural checks on the Chinese reference files (not their content).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'skills/bc-unpaid-wages/references';
const sources = JSON.parse(readFileSync(join(dir, 'sources.json'), 'utf8'));
const ids = new Set(sources.sources.map((s) => s.id));
const files = readdirSync(dir).filter((f) => /^0[1-7]-.*\.md$/.test(f));

test('all seven reference files exist', () => {
  assert.equal(files.length, 7);
});

for (const f of files) {
  const md = readFileSync(join(dir, f), 'utf8');
  test(`${f}: every [来源: id] points at a known source`, () => {
    const used = [...md.matchAll(/\[来源: ([a-z0-9-]+)\]/g)].map((m) => m[1]);
    assert.ok(used.length > 0, 'no source tags');
    for (const id of used) assert.ok(ids.has(id), `unknown source id ${id}`);
  });
  test(`${f}: says it is not legal advice`, () => {
    assert.match(md, /不是法律意见/);
  });
  test(`${f}: no long English passage outside a statute quote (rough check for copied gov.bc.ca text)`, () => {
    const body = md.replace(/^> .*$/gm, ''); // statute quotes are blockquotes
    const long = body.match(/[A-Z][A-Za-z0-9 ,;:'"()\-]{150,}\./g) ?? [];
    assert.deepEqual(long, []);
  });
  test(`${f}: every URL it contains is in sources.json (no URLs from memory)`, () => {
    const known = new Set(sources.sources.filter((s) => s.url).map((s) => s.url.replace(/\/$/, '')));
    known.add('https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/96113_01'); // the Act itself, linked from SKILL.md
    const urls = [...md.matchAll(/https?:\/\/[^\s)）」>]+/g)].map((m) => m[0].replace(/\/$/, '').replace(/[.,;]$/, ''));
    for (const u of urls) assert.ok([...known].some((k) => u.startsWith(k)), `URL not in sources.json: ${u}`);
  });
}

test('every source is cited by at least one reference file', () => {
  const all = files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  for (const s of sources.sources) assert.ok(all.includes(`[来源: ${s.id}]`), `${s.id} is not cited anywhere`);
});

test('used_in in sources.json matches where each source is actually cited', () => {
  for (const s of sources.sources) {
    for (const f of s.used_in) {
      const md = readFileSync(join(dir, `${f}.md`), 'utf8');
      assert.ok(md.includes(`[来源: ${s.id}]`), `${s.id} says used_in ${f} but ${f}.md does not cite it`);
    }
  }
});
