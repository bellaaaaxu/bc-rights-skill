// scripts/build-chat-pack.mjs: build the "chat pack", one text file a person can paste into (or attach to) any AI chat
// app that cannot run scripts: ChatGPT, DeepSeek, Claude.ai, Doubao and the like.
//   node scripts/build-chat-pack.mjs
//     -> chat/bc-unpaid-wages-chat.txt       quick version (default download): reference files 01, 02, 07
//     -> chat/bc-unpaid-wages-chat-full.txt  full version: all seven reference files (intake, form, facts package)
// The weekly GitHub Action rebuilds both after the source check and commits them, so the files on GitHub always carry
// the latest check date and any held-back facts.
// Each pack is SKILL.md without its tool steps (Step 0), preceded by chat-mode instructions that replace them: always
// fallback mode (no live statute text, one closing tag line), stop stating rules 181 days after the last automated check,
// answer in the person's language. Replies follow SKILL.md rule 15 (short by default) and rule 16 (only what was
// checked). Generated, never edited by hand: change SKILL.md or the reference files and rebuild.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { status } from '../skills/bc-unpaid-wages/scripts/status.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const skillDir = join(root, 'skills', 'bc-unpaid-wages');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const sources = JSON.parse(readFileSync(join(skillDir, 'references', 'sources.json'), 'utf8'));
// Dates come from the weekly automated check (no human review step). Held-back facts come from the same status as the skill.
const verified = sources.sources.map((s) => s.last_checked).filter(Boolean).sort()[0];
const st = status(sources, new Date(verified));
const DAY = 86_400_000;
// status.mjs: fail closed when days since the last check > fail_closed_after_days, so the first closed day is +181.
const closedFrom = new Date(new Date(verified).getTime() + (sources.fail_closed_after_days + 1) * DAY).toISOString().slice(0, 10);
const ACT = 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/96113_01';
const ESB_CONTACT = 'https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/contact-us';
const ESB_PROCESS = 'https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/complaint-process';
const REPO = 'https://github.com/bellaaaaxu/bc-rights-skill';
const FULL_URL = `${REPO}/raw/main/chat/bc-unpaid-wages-chat-full.txt`;

// SKILL.md without frontmatter and without "## Step 0" (tool steps).
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '');
const step0 = skill.indexOf('\n## Step 0');
const flow = skill.indexOf('\n## The flow');
if (step0 < 0 || flow < 0 || flow < step0) throw new Error('SKILL.md layout changed: expected "## Step 0" before "## The flow"');
const skillBody = (skill.slice(0, step0) + skill.slice(flow)).trim().replace(/^# /m, '## ');

const VARIANTS = [
  { file: 'bc-unpaid-wages-chat', name: '精简版 quick', refs: ['01-routing-deadlines', '02-first-action', '07-traps'] },
  { file: 'bc-unpaid-wages-chat-full', name: '完整版 full', refs: ['01-routing-deadlines', '02-first-action', '03-intake', '04-package', '05-form', '06-employer-says', '07-traps'] },
];

// Facts to hold back: sources the weekly check found changed (or could not check for a month), and changed statute sections.
function held() {
  if (!st.degraded.length && !st.changed_sections.length) return '';
  const ids = st.degraded.map((d) => d.id).join(', ') || 'none';
  const secs = st.changed_sections.join(', ') || 'none';
  return `
**Hold these back.** The weekly check found that the official sources behind some facts in this guide changed (or could not be checked), and nobody has reviewed them. Do not state a fact tagged [来源: id] for these ids: ${ids}. Do not use this guide's wording for these statute sections: ${secs}. For those, say in a few words that the official source may have changed, and give the official link or the ESB phone line 1-833-236-3700. Everything else in this guide is unaffected.
`;
}

function build(v) {
  const quick = v.refs.length < 7;
  const refText = v.refs
    .map((r) => {
      const t = readFileSync(join(skillDir, 'references', `${r}.md`), 'utf8').replace(/\r\n/g, '\n').trim();
      // Demote the file's own headings by two levels so they sit under the section header.
      return `## 参考文件 references/${r}.md\n\n${t.replace(/^(#{1,4}) /gm, (_, h) => '#'.repeat(Math.min(6, h.length + 2)) + ' ')}`;
    })
    .join('\n\n---\n\n');

  const header = `# BC 欠薪投诉向导 · 聊天版 ${v.name}（bc-unpaid-wages chat pack v${version}）

参考资料最后一次自动核对官方来源：${verified}。从 ${closedFrom} 起，这一版不再陈述任何法律规则，请到 ${REPO} 取新版。
这是一般信息，不是法律意见。能不能拿回钱、拿回多少，由 BC 就业标准处（ESB）决定。

**怎么用**：把这一整份文字复制进 ChatGPT、DeepSeek、Claude、豆包等聊天应用的新对话（或把这个文件作为附件发过去），然后在最后写上你的情况。不要写身份证号、SIN、银行账号。${quick ? '回答默认简短；想看详细的，回复「详细」。' : ''}
**How to use**: paste this whole text into a new chat in any AI chat app (or attach this file), then describe your situation at the end. Do not include a SIN, ID or bank numbers.${quick ? ' Replies are short by default; reply "more" for the full explanation.' : ''}

---

## Instructions for the AI assistant reading this

The person has given you this guide so that you follow it while helping them with an unpaid-wages problem in British Columbia, Canada. Follow it for the rest of the conversation. Do not summarise or repeat the guide back to them. If they have not described their situation yet, ask them to, in one short sentence, and stop.

Answer in the language the person writes their situation in, not the language of this guide: English in, English out; Chinese in, Chinese out. (In testing, one assistant answered an English question in Chinese because most of this guide is Chinese.)

Write only the reply the person will read: no notes to yourself, plans or drafts. Replies are short by default and detailed only when the person asks: follow rule 15 below. Say only what this guide or the person gave you, and say plainly what you could not check: rule 16.

This is the chat version of a skill written for assistants that can run scripts. Here you cannot run scripts and cannot fetch the current text of the law. That changes three things. These points override anything later in this guide that says otherwise.

1. **You are always in fallback mode.** End every reply with one line: 「规则来自 ${verified} 自动核对过的参考资料，未取现行法条原文。一般信息，不是法律意见，结果由 ESB 决定。」 or in English "Rules from reference material checked against the official sources on ${verified}; current statute text not fetched. General information, not legal advice; the ESB decides." In the first reply, add the official text of the Employment Standards Act to that line: ${ACT} . In a detailed reply, also end each sentence that states a legal rule (a deadline set by statute, a limit, a rate, a multiplier, who is covered) with 「（条文未现取；参考资料核对于 ${verified}）」 or "(statute text not fetched; reference material checked ${verified})". Never quote statute wording that is not written in this guide; if they reply "1" for the wording, say this version cannot fetch it and give the Act link.
2. **Out of date: stop stating rules.** If you know today's date and it is ${closedFrom} or later, do not state any legal rule, not even with the tag: no numbers, no multipliers, no paraphrase of a section. Give the ESB contact page ${ESB_CONTACT}, the ESB phone line 1-833-236-3700 and the Act link, and say this version is out of date. One exception: the complaint deadline may be stated as described on the ESB complaint-process page ${ESB_PROCESS}, with that link. If you do not know today's date, give the check date above and suggest checking ${REPO} for a newer version.
3. **Skip the tool steps.** Wherever this guide says to run a script, to use canada-law, to fetch a current section, to read a reference file, or to look in \`sources.json\`: you cannot, and you do not need to. The reference files are included below, each under its file name. Every official URL you may use is written in this guide; \`sources.json\` is not included.
${quick ? `
This quick version includes reference files 01, 02 and 07 only. If the person replies "2" (the form) or "3" (organise the facts), or needs intake questions or a facts package, say that part is in the full version (${FULL_URL}), and meanwhile give the official complaint form link and the ESB phone line.
` : ''}${held()}
If your app can search the web, you may open the official URLs written in this guide to check them. Do not cite any other page, and never compose or retype a URL: copy it character for character.

The guide follows.

---`;

  return `${header}\n\n${skillBody}\n\n---\n\n${refText}\n\n---\n\n（聊天版结束。bc-unpaid-wages chat pack v${version}，${v.name}，参考资料核对于 ${verified}。${REPO}）\n`;
}

mkdirSync(join(root, 'chat'), { recursive: true });
for (const v of VARIANTS) {
  const pack = build(v);
  writeFileSync(join(root, 'chat', `${v.file}.txt`), pack, 'utf8');
  const cjk = (pack.match(/[㐀-鿿]/g) || []).length;
  console.log(`chat/${v.file}.txt: ${pack.length} characters (${cjk} Chinese), about ${Math.round(cjk + (pack.length - cjk) / 4)} tokens; checked ${verified}, rules stop from ${closedFrom}; held back: ${st.degraded.length} sources, ${st.changed_sections.length} sections`);
}
