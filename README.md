# bc-rights-skill

[中文说明](README.zh.md)

Skills that let an AI assistant walk a person through an official procedure in British Columbia, step by step, from the current official sources.

**v0.1 has one skill: `bc-unpaid-wages`.** It helps a worker in BC, or someone helping them, take an unpaid wages, overtime, statutory holiday pay or vacation pay problem to the Employment Standards Branch (ESB): who to contact, the deadline, the first step, what you do **not** have to do first, how to read the complaint form, and how to put the facts together into a package the ESB can use. It answers in Chinese or English, and quotes the statute in English.

It follows the [Agent Skills](https://agentskills.io) standard, so it works in Claude Code, Claude Desktop (via Claude Code), OpenAI Codex, and other assistants that read skills.

> **Please read first**
> - This is general information about a public procedure. **It is not legal advice**, and it never decides anyone's case. The ESB decides complaints.
> - The skill is told to give the deadline, the route and the first step, and to refuse three things: predicting whether you will win, telling you what to settle for, and writing threats. It is told not to give a dollar figure before an hours table and a payment table exist.
> - **There is no evidence that using this skill improves the outcome of a real complaint.** What has been tested is described below, and it was tested by the people who wrote it.
> - Whether the assistant fetches live statute text depends on the app you use and on whether the companion `canada-law` skill is installed. Without it the skill says so in its first paragraph and answers from dated reference files.

## What was tested, and what was not

Full counts, method and caveats: [`evals/results/2026-09-28.md`](evals/results/2026-09-28.md). Test sets and the grading rubric: [`evals/`](evals/). Everything below is a raw count from a small sample.

**Three test layers**, all offline, all graded against a written rubric of eight *blocking* errors (wrong deadline, wrong agency, invented prerequisites, confidentiality overclaim, wrong phone or URL, deciding the case, stating a figure as what is owed, writing threats):

| Layer | What it is | Result with the skill (Claude Opus 5.5) | Same model, no skill |
|---|---|---|---|
| Procedure set | 22 fixed scenarios, Chinese and English | 2 of 22 answers had a blocking error (one mistyped URL; one figure computed from numbers in the question) | 10 of 22 |
| Journey set | 10 messy, emotional narratives | 0 of 10; all six required behaviours in all 10 | 7 of 10 |
| Hold-out sets (new questions after the skill was changed) | 5 + 3 narratives | 0 of 8 | 7 of 8 |
| Decision set | 8 published BC Employment Standards Tribunal decisions, replayed as a conversation with a scripted "worker" who only knows the facts | 2 of 8 packages had a deadline error, both in how a rule from an earlier year was applied; 0 for the other seven error types. Secondary rules (overtime thresholds, holiday eligibility, vacation pay on back pay) were missed in every package | not run |

A second model, OpenAI Codex, was run on a 10-question sample: 0 of 10 answers with the skill had a blocking error; 6 of 10 without it (Codex browses the web by default, so its "no skill" arm is not comparable to Claude's). Half of the Codex runs read Codex's own memory file, so that environment was not clean; the runner now moves that folder aside.

**Not tested**: a full Codex run; any DeepSeek run; any real worker or any real complaint. The grader for the first three layers was the same assistant that wrote the skill (grading was blind to which arm produced an answer). "Verified by a person" in the source list means an AI assistant read the official page or statute section in the session, not a lawyer.

## Install

You need [Node.js](https://nodejs.org) 20 or newer.

**1. Install `canada-law`** (current official text of BC and federal employment statutes; the skill fetches every section it quotes through it):

```bash
npx https://github.com/bellaaaaxu/canada-law/releases/download/v0.2.2/canada-law-0.2.2.tgz install
```

**2. Install this skill.** With the [skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add bellaaaaxu/bc-rights-skill
```

Or copy the folder by hand into the skills directory of your assistant, for example `~/.claude/skills/bc-unpaid-wages` (Claude Code) or `~/.agents/skills/bc-unpaid-wages` (Codex):

```bash
git clone https://github.com/bellaaaaxu/bc-rights-skill
cp -r bc-rights-skill/skills/bc-unpaid-wages ~/.claude/skills/
```

**3. Ask.** For example: "我在温哥华一家餐馆打工，老板欠我两个月工资，我已经离职一个月了，该怎么办？" or "My boss hasn't paid my last three weeks and I was told not to come back. Where do I start?" The skill triggers on complaint-type questions about unpaid wages in BC; a bare "what does section 74 say" goes to `canada-law` instead.

## How an answer is built

1. **Status first.** The skill runs its own `scripts/status.mjs`, which reads `references/sources.json`: 22 official sources, each with the date it was last checked by automation and the date a person last read it. If a statute source has changed since it was read, or no one has read the sources for 180 days, the skill enters **fail-closed mode**: it gives links and the ESB phone number but states no rule as a fact. (180 days is this project's own threshold, not a legal one.)
2. **Live statute text.** Every section it quotes is fetched through `canada-law` at answer time. Without `canada-law`, the first paragraph says so and gives the install command, and every rule sentence is tagged as coming from reference files last verified on a stated date.
3. **Reference files** (Chinese, in `references/`): routing and deadlines, the first action, an intake question list, a facts-package template, how to read the six parts of the official form, what employers commonly say, common traps. Every statement carries a source id; official URLs are copied from the files, never typed from memory.
4. **Fourteen rules** in `SKILL.md`, each added because a test failed without it: deadline stated conditionally until the end date is confirmed; no invented prerequisites; no conclusions; no threats; six single questions per round; no figure before tables; events in an earlier year are checked against the rules of that year.

The footer of every answer shows the two dates: when the statute text was current, and when a person last verified the reference files.

### Example

From the hold-out set (Claude Opus 5.5 with the skill, 28 September 2026), shortened; the full text is in `docs/acceptance/2026-09-28-M4-跑分.md`.

> **Q:** Back in 2022 I worked at a Burnaby warehouse from May to December, hourly, and they never paid stat holiday pay for any holiday that year, including Sept 30 which everyone told me was a holiday. I left in Dec 2022. I only found out about the Employment Standards Branch now. What was I actually owed for those holidays and is it too late?
>
> Short answer: the complaint deadline passed in 2023. The law does let the Branch accept a late complaint, but only under a strict test, and September 30, 2022 was probably not a BC stat holiday.
>
> **1. Is it too late?** The Act says (s.74): "(3) A complaint relating to an employee whose employment has terminated must be delivered … within 6 months after the last day of employment." "(5) On application, the director may extend the time … including making an extension after the time to deliver has expired, if the director is satisfied that (a) special circumstances exist or existed … and (b) an injustice would otherwise result." … Your only route to the Branch now is to **ask for an extension**. The Branch decides whether your reasons meet that test. I can't predict the result.
>
> **3. September 30, 2022.** According to the reference files, the National Day for Truth and Reconciliation became a BC stat holiday in 2023 … Treat this as "to be confirmed under the rules of the time."
>
> *This part was not checked against an official source:* the 2022 BC stat holidays falling while you worked there were probably … Also, s.44 to s.46 above are today's text. I haven't confirmed they read exactly the same in 2022.
>
> To help with the extension request and a holiday-by-holiday table, I need to know: 1. What was your exact last day of work? 2. What was your exact first day? 3. Were you in a union? 4. Did you work on any of those holidays? 5. Do you still have your pay stubs or bank deposit records? 6. What, if anything, stopped you from filing in the first half of 2023?

## Freshness

`references/sources.json` carries two dates per source. `last_checked` is written by a weekly GitHub Action that re-fetches every page and re-hashes every statute section through `canada-law`; a change opens an issue. `last_human_verified` changes only when someone runs `npm run accept` after reading the changed source. The skill refuses to state rules when the second date is more than 180 days old or a statute source has changed and not been re-read.

## Cost

An answer with the skill takes 7 to 11 tool calls (status script, reference files, statute sections), about three times the tokens of the same model answering from memory. On Codex that was 120,000 to 270,000 tokens per answer in our runs, most of it cached context re-sent each turn. On a subscription plan this matters more than the dollar cost.

## Reporting a mistake

Open a [GitHub issue](https://github.com/bellaaaaxu/bc-rights-skill/issues). Quote the sentence that is wrong and, if you can, the official source that contradicts it. **Do not paste your own case documents, names, employer names or pay records** into an issue.

## Development

```bash
npm test          # unit and structure tests (55)
npm run validate  # skills-ref validate
npm run check     # re-check all 22 official sources (needs canada-law for the statute hashes)
npm run accept    # after reading a changed source: record the new baseline and today's human-verified date
```

The evaluation runners are in `evals/run/`. Test sets were frozen before the runs (commit hashes in `docs/acceptance/`). Graded answers and transcripts stay in `.local/`, outside the repository.

## Licence

Code: MIT. Original text (reference files, tests): CC BY 4.0. Statute text is fetched at run time from BC Laws under the King's Printer Licence and is not an official version. Government of BC web pages and forms are not reproduced here; they are linked and described in the project's own words. Details in [`NOTICE.md`](NOTICE.md).
