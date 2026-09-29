# bc-rights-skill

[中文说明](README.zh.md)

An official procedure in British Columbia, turned into a guide an AI assistant can walk a person through: who to contact, the deadline, the first step, what you do **not** have to do first, how to read the form, and how to put the facts together. It works from the current official sources.

**One procedure so far: `bc-unpaid-wages`.** It helps a worker in BC, or someone helping them, take an unpaid wages, overtime, statutory holiday pay or vacation pay problem to the Employment Standards Branch (ESB). Chinese or English.

> **Please read first**
> - This is general information about a public procedure. **It is not legal advice**, and it never decides anyone's case. The ESB decides complaints.
> - **Replies are short by default**: the deadline, the next step, what is not needed first, and at most three questions. Reply "more" for the full explanation.
> - **It says when it does not know.** It does not make up dates, figures or links; when an official source has recently changed, it says so and points to the ESB phone line.
> - It refuses to predict whether you will win, to suggest what to settle for, and to write threats. No dollar figure before an hours table and a payment table exist.
> - **There is no evidence that using it improves the outcome of a real complaint.** What has been tested is below, and it was tested by the people who wrote it.

## Three ways to use it

**1. Any AI chat app (simplest, nothing to install)**

Download the chat pack and attach it to (or paste it into) a new chat in ChatGPT, DeepSeek, Claude, Doubao and the like, then describe your situation:

- Quick version (default, about 8,400 tokens): <https://github.com/bellaaaaxu/bc-rights-skill/raw/main/chat/bc-unpaid-wages-chat.txt>
- Full version (for organising your facts and reading the form, about 16,800 tokens): <https://github.com/bellaaaaxu/bc-rights-skill/raw/main/chat/bc-unpaid-wages-chat-full.txt>

Both files are rebuilt every week. The chat version cannot fetch current statute text; its rules come from reference files checked automatically every week, and every reply ends with the check date.

**2. claude.ai or the Claude desktop app**

Download `bc-unpaid-wages.zip` and `canada-employment-law.zip` from the [release page](https://github.com/bellaaaaxu/bc-rights-skill/releases) and upload both under **Customize → Skills → + → Upload a skill** ("Code execution and file creation" must be on). Tested 2026-09-29: the skill triggers. The claude.ai sandbox may not reach BC Laws; when it cannot, the answer says so and works from the reference files.

**3. Claude Code, Codex and other assistants that run scripts**

You need [Node.js](https://nodejs.org) 20 or newer. Install `canada-law` (current statute text) first, then this skill:

```bash
npx https://github.com/bellaaaaxu/canada-law/releases/download/v0.2.3/canada-law-0.2.3.tgz install
```

```bash
npx skills add bellaaaaxu/bc-rights-skill
```

Or copy `skills/bc-unpaid-wages` into your assistant's skills folder, for example `~/.claude/skills/` (Claude Code) or `~/.agents/skills/` (Codex).

## Maintained automatically, no human review

- **Every week** a GitHub Action re-checks all 22 official sources: key sentences still on the ESB pages, the complaint form PDF unchanged, the 41 statute sections the reference files rely on unchanged.
- **When a source changes, only what rests on it stops.** Every sentence in the reference files is tagged with its source; the changed part is no longer stated, and the answer says the official source may have just changed and gives the official link or 1-833-236-3700. Statutes are handled section by section, so one amended section does not silence the whole Act.
- **Installed copies follow along**: when online, the skill reads the latest check results from GitHub before answering, so nobody has to reinstall. That is one request for a public file, with no personal information.
- **Safety net**: if the automated check has not run for more than 180 days (the weekly job stopped, or an offline copy is old), the skill stops stating any legal rule and gives only official links and the phone line. 180 days is this project's own threshold, not a legal rule.
- The reference files were first written by an AI assistant reading the official pages and statute sections in the session, not by a lawyer.

## What was tested, and what was not

Full counts, method and caveats: [`evals/results/`](evals/results/). Small samples, raw counts. The rubric has nine *blocking* errors (wrong deadline, wrong agency, invented prerequisites, confidentiality overclaim, wrong phone or URL, deciding the case, stating a figure as what is owed, writing threats, stating an unchecked date or figure as checked).

| Test | Result |
|---|---|
| Short replies (v0.2), 5 new questions × 3 ways of use | 0 of 15 with a blocking error |
| Short replies, regression on 32 earlier questions × skill and chat pack | 0 of 64; median first-reply length down from 500–770 to about 280 (skill) and 210 (chat pack) Chinese characters or English words |
| Chat pack, Claude with no tools, 40 questions | 0 of 40 with the pack; 23 of 40 without |
| Chat pack, GPT model (via Codex), 10 questions | 0 of 10 |
| v0.1 frozen sets (Claude Opus 5.5 with the skill) | 22 scenarios 2 of 22; 10 messy stories 0 of 10; 8 published decisions 2 of 8 (both on the rules of an earlier year) |
| Simulated source change | With the complaint-process page and s.74 marked changed: the chat pack stopped stating the deadline and sent the person to the official page or phone line; the skill with canada-law fetched the current s.74 before stating it |

**Known issues**: about half of English first replies are over the 150-word target; the first question often asks two things ("Are you still working there? If not, what was your last day?"); in the no-thinking test setup a few replies began with the model's own drafting notes (1 in 8 after the fix).

**Not tested**: real DeepSeek, Doubao or ChatGPT web apps; any real worker or real complaint. The grader was the same assistant that wrote the skill.

## Cost

- Skill: 4 to 5 tool calls per answer (was 7 to 11), about US$0.15 with Claude.
- Chat pack: the first reply reads the whole pack (quick version about 8,400 tokens), and every later reply in the same chat carries it.
- GPT model via Codex with the quick pack: about 33,000 tokens per answer, against 150,000–240,000 with the skill.

## How an answer is built

1. **One start command.** `scripts/start.mjs` prints the status (latest automated check) and the two reference files the first reply needs.
2. **Statute text only when needed**, through `canada-law`, when the person asks about a rule or for the wording. If it cannot be fetched, the answer says so and does not fill in from elsewhere.
3. **Reference files** (Chinese): routing and deadlines, first step, intake questions, facts package, the form, what employers say, common traps. Every statement is tagged with its source.
4. **Sixteen rules** in `SKILL.md`, each added after a test failed without it: deadline stated conditionally, no invented prerequisites, no conclusions, short by default, only what was checked, and so on.

## Reporting a mistake

Open a [GitHub issue](https://github.com/bellaaaaxu/bc-rights-skill/issues). Quote the sentence that is wrong and, if you can, the official source that contradicts it. **Do not paste your own case documents, names, employer names or pay records** into an issue.

## Development

```bash
npm test                         # unit and structure tests
npm run validate                 # skills-ref validate
npm run check                    # re-check the 22 official sources (statute part needs canada-law)
node scripts/build-chat-pack.mjs # rebuild the two chat packs in chat/
```

`npm run accept` is optional: after someone has read a changed source and updated the reference files, it records the new baseline. Without it nothing unsafe happens; the changed part simply stays held back. The evaluation runners are in `evals/run/`; graded answers stay in `.local/`, outside the repository.

## Licence

Code: MIT. Original text (reference files, tests): CC BY 4.0. Statute text is fetched at run time from BC Laws under the King's Printer Licence and is not an official version. Government of BC web pages and forms are not reproduced here; they are linked and described in the project's own words. Details in [`NOTICE.md`](NOTICE.md).
