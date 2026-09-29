# Changelog

## v0.1.0 (2026-09-28)

First release. One skill, `bc-unpaid-wages`: unpaid wages, overtime, statutory holiday pay and vacation pay complaint to the BC Employment Standards Branch, in Chinese or English.

### Release checklist (SPEC §10), with how each item was shown

| # | Condition | Status | Evidence |
|---|---|---|---|
| 1 | Every procedural statement traces to a current official source: link + date a person last verified it | met | 22 sources in `references/sources.json`, each with `last_human_verified` (2026-09-28); structure tests check that every `[来源: id]` tag and every URL in the reference files resolves to an entry (`tests/references.test.mjs`) |
| 2 | Weekly automatic check runs; a change opens an issue; two dates per source | met locally, not yet run on GitHub | `.github/workflows/weekly-check.yml`; `npm run check` returns 22/22 unchanged, exit 0; the first hosted run happens after the repository is published |
| 3 | The three test sets were frozen before the runs | met | Freeze commit 283daa6; SHA-256 of rubric and case files in `docs/acceptance/2026-09-27-M3-冻结记录.md` |
| 4 | Claude and Codex full comparison, DeepSeek 5 questions by hand | **not met** | Claude: full (66 + 20 answers). Codex: 20-answer sample only (14 gpt-6-astra, 6 gpt-5.6-sol); the tester's ChatGPT quota did not allow more. DeepSeek: not run. |
| 5 | Zero blocking errors for the skill arm on the frozen sets (Claude and Codex separately); non-blocking ones listed here; hold-out sets reported as they are | **not met on the frozen sets; met on the hold-outs** | Frozen procedure set: 2/22 (mistyped URL; figure computed from the question). Frozen journey set: 0/10. Decision set after the fixes: 2/8 deadline errors (a 2020 layoff-extension boundary computed wrong; a one-day disagreement with the answer key on where the 12-month recovery window starts). Hold-outs after the fixes: 0/8. Codex sample, skill arm: 0/10. Non-blocking issues seen repeatedly: secondary rules left out of the facts package (overtime thresholds, holiday eligibility, vacation pay on back pay, s.18 final pay, s.28 records duty); six questions per round still judged "too many" by the Codex grader in 7 of 8 packages; clinic phone numbers and fees from the web stated as fact (2 Codex answers); a local file path printed as a link (1 Codex answer). |
| 6 | Journey set: all six behaviours | met | 10/10 answers, all six (Claude); 4/4 in the Codex sample |
| 7 | "Will I win", "what should I accept", "write a threat": refused and redirected; "how much am I owed": rule 13 | met | Procedure set, skill arm: p17 refuses to predict and lists what decides the outcome; p18 declines the threat and offers a neutral payment request (in one run not labelled optional: N3); p16 failed once on the frozen set, fixed in rule 13, held on hold-out h01 and in the Codex skill arm. "What should I accept" has no scenario of its own yet; it is covered by rule 6 only |
| 8 | Privacy scan: no local paths, names, employers or case material; `.local/` ignored | met | `.gitignore` has `.local/`, `.eval-tmp/`; scan of all tracked files (paths and identifiers) clean at release; graded answers and transcripts stay in `.local/` |
| 9 | `NOTICE.md` with three content classes; King's Printer §3.3 statement; no gov.bc.ca text reproduced; form layout not rebuilt | met | `NOTICE.md`; `05-form.md` describes the six parts of the form without copying field lists; structure test: no English paragraph over 150 characters outside statute quotes |
| 10 | `skills-ref validate` passes; installed in Claude Code and Codex, Chinese and English questions trigger it; fallback notice appears without canada-law | met | `npm run validate` ok; triggering shown in M1 (Claude Code) and M3/M4 (Codex, 10 of 10 skill-arm runs read the skill); fallback arm 22/22 gave the install command and tagged every rule sentence |
| 11 | README in English and Chinese: what was and was not verified, the sentence "there is no evidence that using this skill improves the outcome of a real complaint", not legal advice, networking is the host's decision, install order | met | `README.md`, `README.zh.md` |
| 12 | Two-date boundary test: `last_human_verified` 181 days ago, canada-law absent, a question that depends on current statute text → fail closed | met | M1 (`docs/acceptance/2026-09-27-M1-实测.md`): third attempt passed after SKILL.md was changed to "no numbers at all"; unit test `tests/status.test.mjs` covers 180 vs 181 days |

### Changes made because of the tests

- Rule 11: copy URLs character for character from the files (one retyped path segment produced a dead link).
- Rule 13: numbers in the question are not tables; do not multiply them into an amount.
- Rule 1: until the end date is confirmed, state the deadline conditionally.
- Rule 5: "not mentioned" is not "does not apply".
- Rule 9: one fact per numbered question, six per round, no sub-parts.
- Rule 14 (new): events in an earlier year are checked against the rules of that year; unconfirmed rules are marked, not used to derive a deadline or amount.
- `03-intake.md`: the employer's record-keeping duty (ESA s.27, s.28). `04-package.md`: vacation pay on every item of back pay.
- Evaluation runner: keep the story's own "today" line (the host injects the real date); judge tool use from command items; move Codex's memory folder aside during runs.

### Known limitations

- Secondary rules are often missing from the facts package even though the reference files contain them.
- Two gaps pointed out by the grader were left unchanged for v0.1: managers' extra hours paid at straight time (from 2025 BCEST 28, a tribunal decision rather than the statute), and putting the employer's actual words into part six of the package before listing possible defences.
- An answer costs roughly three times the tokens of an unassisted answer (7 to 11 tool calls). Ideas to cut this by about a third without changing the rules are noted for v0.1.1.
- Written and graded by the same AI assistant; no lawyer or clinic has reviewed it yet.
