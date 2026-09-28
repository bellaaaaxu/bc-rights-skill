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

/** Write the results back: last_checked always; on accept, baseline + last_human_verified for every source that was checked. */
export function applyResults(sources, results, today, accept) {
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  return {
    ...sources,
    sources: sources.sources.map((s) => {
      const r = byId[s.id];
      if (!r) return s;
      const next = { ...s, last_checked: today, status: r.status };
      if (accept && r.status !== 'error') {
        next.status = 'ok';
        next.last_human_verified = today;
        if (r.baseline !== null) next.baseline = r.baseline;
      }
      return next;
    }),
  };
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
