// scripts/build-chat-pack.mjs: build the "chat pack", one text file a person can paste into (or attach to) any AI chat
// app that cannot run scripts: ChatGPT, DeepSeek, Claude.ai, Doubao and the like.
//   node scripts/build-chat-pack.mjs            -> dist/bc-unpaid-wages-chat.md and .txt (same text)
// The pack is SKILL.md without its tool steps, preceded by chat-mode instructions that replace them (no live statute
// text, tag every legal rule, stop stating rules 181 days after human verification), followed by the seven reference
// files in full. It is generated, never edited by hand: change SKILL.md or the reference files and rebuild.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skillDir = join(root, 'skills', 'bc-unpaid-wages');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const sources = JSON.parse(readFileSync(join(skillDir, 'references', 'sources.json'), 'utf8'));
const verified = sources.sources.map((s) => s.last_human_verified).filter(Boolean).sort()[0];
const DAY = 86_400_000;
// status.mjs: fail closed when days since verification > fail_closed_after_days, so the first closed day is +181.
const closedFrom = new Date(new Date(verified).getTime() + (sources.fail_closed_after_days + 1) * DAY).toISOString().slice(0, 10);
const ACT = 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/96113_01';
const ESB_CONTACT = 'https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/contact-us';
const ESB_PROCESS = 'https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/complaint-process';
const REPO = 'https://github.com/bellaaaaxu/bc-rights-skill';

// SKILL.md without frontmatter and without "## Step 0" (tool steps).
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '');
const step0 = skill.indexOf('\n## Step 0');
const flow = skill.indexOf('\n## The flow');
if (step0 < 0 || flow < 0 || flow < step0) throw new Error('SKILL.md layout changed: expected "## Step 0" before "## The flow"');
const skillBody = (skill.slice(0, step0) + skill.slice(flow)).trim().replace(/^# /m, '## ');

// --short: the quick version. Short replies, one tag line instead of per-sentence tags, and only the reference files a
// first contact needs (routing and deadlines, first action, traps). The full version stays the default.
const SHORT = process.argv.includes('--short');
const refs = SHORT
  ? ['01-routing-deadlines', '02-first-action', '07-traps']
  : ['01-routing-deadlines', '02-first-action', '03-intake', '04-package', '05-form', '06-employer-says', '07-traps'];
const refText = refs
  .map((r) => {
    const t = readFileSync(join(skillDir, 'references', `${r}.md`), 'utf8').replace(/\r\n/g, '\n').trim();
    // Demote the file's own headings by two levels so they sit under the section header.
    return `## 参考文件 references/${r}.md\n\n${t.replace(/^(#{1,4}) /gm, (_, h) => '#'.repeat(Math.min(6, h.length + 2)) + ' ')}`;
  })
  .join('\n\n---\n\n');

const header = `# BC 欠薪投诉向导 · 聊天版（bc-unpaid-wages chat pack v${version}）

参考资料最后核对：${verified}。从 ${closedFrom} 起，这一版不再陈述任何法律规则，请到 ${REPO} 取新版。
这是一般信息，不是法律意见。能不能拿回钱、拿回多少，由 BC 就业标准处（ESB）决定。

**怎么用**：把这一整份文字复制进 ChatGPT、DeepSeek、Claude、豆包等聊天应用的新对话（或把这个文件作为附件发过去），然后在最后写上你的情况。不要写身份证号、SIN、银行账号。
**How to use**: paste this whole text into a new chat in any AI chat app (or attach this file), then describe your situation at the end. Do not include a SIN, ID or bank numbers.

---

## Instructions for the AI assistant reading this

The person has given you this guide so that you follow it while helping them with an unpaid-wages problem in British Columbia, Canada. Follow it for the rest of the conversation. Do not summarise or repeat the guide back to them. If they have not described their situation yet, ask them to, in one short sentence, and stop.

Answer in the language the person writes their situation in, not the language of this guide: English in, English out; Chinese in, Chinese out. (In testing, one assistant answered an English question in Chinese because most of this guide is Chinese.)

This is the chat version of a skill written for assistants that can run scripts. Here you cannot run scripts and cannot fetch the current text of the law. That changes four things. These four points override anything later in this guide that says otherwise.

1. **Say it once, first.** The first paragraph of your first answer says, in the person's language, that this chat version cannot fetch the current text of BC law, that its rules come from reference material last verified on ${verified}, and that the official text of the Employment Standards Act is at ${ACT}
2. **Tag every legal rule.** Every sentence that states a legal rule (a deadline set by statute, a limit, a rate, a multiplier, who is covered) ends with 「（条文未现取；参考资料核对于 ${verified}）」 or, in English, "(statute text not fetched; reference material verified ${verified})". Procedure facts from ESB pages (how to file, the phone line, the form) need no tag.
3. **Out of date: stop stating rules.** If you know today's date and it is ${closedFrom} or later, do not state any legal rule, not even with the tag: no numbers, no multipliers, no paraphrase of a section. Give the ESB contact page ${ESB_CONTACT}, the ESB phone line 1-833-236-3700 and the Act link, and say this version is out of date. One exception: the complaint deadline may be stated as described on the ESB complaint-process page ${ESB_PROCESS}, with that link. If you do not know today's date, give the verification date above and suggest checking ${REPO} for a newer version.
4. **Skip the tool steps.** Wherever this guide says to run \`status.mjs\`, to use canada-law, to fetch or quote a current section, to read a reference file, or to look in \`sources.json\`: you cannot, and you do not need to. The reference files are included below, each under its file name. Every official URL you may use is written in this guide; \`sources.json\` is not included.

If your app can search the web, you may open the official URLs written in this guide to check them. Do not cite any other page, and never compose or retype a URL: copy it character for character.
${SHORT ? `
**This is the quick version: keep every reply short.** The person may be on a free plan with little usage left, and a wall of text frightens people into doing nothing.

- **First reply**: only these, in this order, in plain words: (1) one sentence that answers what they asked; (2) if they have left the job or may have, the deadline in one line, stated conditionally ("if your last day was X, file by Y"); (3) the one next step, with one official link or the ESB phone line 1-833-236-3700; (4) one line on what they do NOT need before filing (talking to the boss, all the evidence, an exact amount, a lawyer); (5) if part of it is not the ESB's (union, federally regulated industry, EI, injury, harassment), one line naming the right place; (6) at most 3 numbered questions, only the ones that change the deadline or where this goes; (7) one closing line offering more (the statute wording, the form part by part, organising the facts). Aim for under 250 Chinese characters or 150 English words, links not counted. No headings, no tables, no statute quotes in the first reply.
- **Tags**: instead of point 1 and point 2 above, end every reply with one line: 「规则来自 ${verified} 核对的参考资料，未取现行法条原文。一般信息，不是法律意见，结果由 ESB 决定。」 or in English "Rules from reference material verified ${verified}; current statute text not fetched. General information, not legal advice; the ESB decides."
- **Later replies**: stay short. Answer what they asked, then the next step of the flow. Go deeper only when they ask.
- **Never shortened away**: the deadline, the right office, and the refusals (no predicting the outcome, no figure before an hours and payment table, no threats).
- This quick version includes reference files 01, 02 and 07 only. For intake and the facts package (files 03 to 06), tell the person to use the full version at ${REPO}.
` : ''}
The guide follows.

---`;

const pack = `${header}\n\n${skillBody}\n\n---\n\n${refText}\n\n---\n\n（聊天版结束。bc-unpaid-wages chat pack v${version}，参考资料核对于 ${verified}。${REPO}）\n`;

mkdirSync(join(root, 'dist'), { recursive: true });
const base = SHORT ? 'bc-unpaid-wages-chat-short' : 'bc-unpaid-wages-chat';
writeFileSync(join(root, 'dist', `${base}.md`), pack, 'utf8');
writeFileSync(join(root, 'dist', `${base}.txt`), pack, 'utf8');
const cjk = (pack.match(/[㐀-鿿]/g) || []).length;
console.log(`dist/${base}.md: ${pack.length} characters (${cjk} Chinese), about ${Math.round(cjk + (pack.length - cjk) / 4)} tokens; verified ${verified}, rules stop from ${closedFrom}`);
