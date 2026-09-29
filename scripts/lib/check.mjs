// scripts/lib/check.mjs
// The pure part of the weekly check: given the sources list and ways to fetch pages and statute text, say what
// changed. Nothing here touches the network or the disk, so tests can drive it with fakes.
const normalize = (s) => s.replace(/[‐-―−]/g, '-').replace(/[​­]/g, '').replace(/\s+/g, ' ').toLowerCase();

export function pageText(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return normalize(text + ' ' + html); // keep the raw HTML too, so links in href attributes count
}

/** One result per source: { id, status: 'ok'|'changed'|'error'|'new', detail, baseline } */
export async function evaluate(sources, io) {
  const out = [];
  for (const s of sources.sources) {
    try {
      if (s.type === 'reachable') {
        await io.get(s.url);
        out.push({ id: s.id, status: 'ok', detail: 'reachable', baseline: null });
      } else if (s.type === 'phrases') {
        const text = pageText(String(await io.get(s.url)));
        const missing = s.phrases.filter((p) => !text.includes(normalize(p)));
        out.push({
          id: s.id,
          status: missing.length ? 'changed' : 'ok',
          detail: missing.length ? `missing: ${missing.map((m) => `"${m}"`).join(', ')}` : `found: ${s.phrases.map((m) => `"${m}"`).join(', ')}`,
          baseline: null,
        });
      } else if (s.type === 'hash') {
        const h = io.sha(String(await io.get(s.url)));
        const status = !s.baseline ? 'new' : s.baseline === h ? 'ok' : 'changed';
        out.push({
          id: s.id,
          status,
          detail: status === 'ok' ? `same as baseline ${h.slice(0, 12)}` : status === 'new' ? `no baseline yet, now ${h.slice(0, 12)}` : `file changed: baseline ${s.baseline.slice(0, 12)}, now ${h.slice(0, 12)}`,
          baseline: h,
        });
      } else if (s.type === 'law') {
        const baseline = {};
        const changed = [];
        const fresh = [];
        for (const [act, sec] of s.sections) {
          const j = await io.law(act, sec);
          const key = `${act}:${sec}`;
          const h = io.sha(j.text);
          baseline[key] = h;
          const old = s.baseline?.[key];
          if (!old) fresh.push(`${act} s.${sec}`);
          else if (old !== h) changed.push(`${act} s.${sec} (current to ${j.current_to})`);
        }
        const status = changed.length ? 'changed' : fresh.length ? 'new' : 'ok';
        out.push({
          id: s.id,
          status,
          detail: changed.length ? `text changed: ${changed.join(', ')}` : fresh.length ? `no baseline yet: ${fresh.join(', ')}` : `${s.sections.length} sections same as baseline`,
          baseline,
          // Which sections changed, so the skill stops only the rules that rest on them (status.mjs, SKILL.md Step 0).
          changed_sections: changed.map((c) => c.replace(/ \(current to .*\)$/, '')),
        });
      } else {
        out.push({ id: s.id, status: 'error', detail: `unknown type ${s.type}`, baseline: null });
      }
    } catch (e) {
      out.push({ id: s.id, status: 'error', detail: `could not check: ${e.message}`, baseline: null }); // not a pass
    }
  }
  return out;
}

/**
 * Write the results back. Every run: last_checked, status, last_ok (the last day the source was confirmed unchanged or
 * reachable) and, for statute sources, changed_sections. No person has to act on a change: status.mjs turns a changed
 * source into "do not state these facts; say it may have changed; give the official link" (SKILL.md Step 0).
 * On accept (optional, when a maintainer has reviewed a change): new baseline, status ok, last_human_verified.
 */
export function applyResults(sources, results, today, accept) {
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  return {
    ...sources,
    sources: sources.sources.map((s) => {
      const r = byId[s.id];
      if (!r) return s;
      const next = { ...s, last_checked: today, status: r.status };
      if (r.status === 'ok' || r.status === 'new') next.last_ok = today;
      if (s.type === 'law') next.changed_sections = r.changed_sections ?? [];
      if (accept && r.status !== 'error') {
        next.status = 'ok';
        next.last_ok = today;
        next.last_human_verified = today;
        if (s.type === 'law') next.changed_sections = [];
        if (r.baseline !== null) next.baseline = r.baseline;
      }
      return next;
    }),
  };
}

/**
 * Try a fetch again after a pause. Government sites sometimes refuse one request from a cloud runner and answer the
 * next; a missing page (404, 410) is not retried.
 */
export async function withRetry(fn, delays = [10000, 30000], sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= delays.length || /^HTTP 4(04|10)\b/.test(e.message)) throw e;
      await sleep(delays[i]);
    }
  }
}

/**
 * The scheduled job runs every day but checks only when it is due: a week after the last check, or the next day when
 * the last run could not reach a source. One refused run then costs a day, not a week of the 30-day grace.
 */
export function due(sources, today, everyDays = 7) {
  const list = sources.sources;
  if (list.some((s) => s.status === 'error' || !s.last_checked)) return true;
  const oldest = list.map((s) => s.last_checked).sort()[0];
  return (Date.parse(today) - Date.parse(oldest)) / 86400000 >= everyDays;
}

export function report(results, sources, today) {
  const count = (st) => results.filter((r) => r.status === st).length;
  const what = Object.fromEntries(sources.sources.map((s) => [s.id, s]));
  const label = { ok: 'unchanged', changed: '**possibly changed**', error: '**not checked**', new: '**new, needs baseline**' };
  return [
    `# Source check ${today}`,
    '',
    `${count('ok')} unchanged, ${count('changed')} possibly changed, ${count('error')} not checked, ${count('new')} new.`,
    '',
    '| status | source | result | used in |',
    '|---|---|---|---|',
    ...results.map((r) => `| ${label[r.status]} | ${what[r.id].what} | ${r.detail} | ${what[r.id].used_in.join(', ')} |`),
    '',
  ].join('\n');
}
