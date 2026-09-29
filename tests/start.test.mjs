// tests/start.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startText, FIRST_REPLY_FILES } from '../skills/bc-unpaid-wages/scripts/start.mjs';

test('start prints the status JSON and the two first-reply reference files, in that order', async () => {
  const t = await startText();
  const s = t.indexOf('===== status =====');
  const a = t.indexOf('===== references/01-routing-deadlines.md =====');
  const b = t.indexOf('===== references/02-first-action.md =====');
  assert.ok(s === 0 && a > s && b > a, 'sections in order');
  const json = JSON.parse(t.slice(s + '===== status ====='.length, a));
  assert.ok('fail_closed' in json && 'last_checked' in json && 'degraded' in json && 'changed_sections' in json && 'canada_law_script' in json);
  assert.deepEqual(FIRST_REPLY_FILES, ['01-routing-deadlines.md', '02-first-action.md']);
});

test('start runs as a command from the skill folder', () => {
  const cwd = fileURLToPath(new URL('../skills/bc-unpaid-wages/', import.meta.url));
  const out = execFileSync(process.execPath, ['scripts/start.mjs'], { cwd, encoding: 'utf8' });
  assert.match(out, /===== references\/02-first-action\.md =====/);
});
