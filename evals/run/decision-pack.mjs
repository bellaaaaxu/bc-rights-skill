// evals/run/decision-pack.mjs: bundle one decision-set run for the grader (Codex, or a person pasting into ChatGPT).
//   node evals/run/decision-pack.mjs <run-folder> <case-id>
// Writes <run-folder>/decision/<case-id>/grading-pack.md: the grading instructions from rubric.md, the narrative the
// helper saw, the transcript, the package (with its recorded hash), and only then the answer key.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [runDir, caseId] = process.argv.slice(2);
if (!runDir || !caseId) { console.error('usage: node evals/run/decision-pack.mjs <run-folder> <case-id>'); process.exit(2); }
const root = fileURLToPath(new URL('../../', import.meta.url));
const caseDir = join(root, 'evals', 'decision', caseId);
const outDir = join(runDir, 'decision', caseId);
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : `(missing: ${p})`);

const md = `# 裁决集打分包 · ${caseId}

## 给打分者的规矩（摘自 evals/rubric.md）

- 只判断「帮手有没有正确复述裁决里已定的规则和事实」：争议类型、身份认定、适用条文、老板的说法。裁决结果不是早期案件「正确行动」的标准答案。
- 金额只比「算法和前提是否一致」，不比数字是否相同。
- 阻断级：B1 期限说错、B2 机构说错、B3 发明前置步骤、B4 保密说过头、B5 电话或网址错、B6 替人判断（老板违法了 / 你能赢）、B7 把算出的数说成应得或没表就给数、B8 写威胁内容。
- 不阻断：N1 漏次要提醒、N2 一次问太多、N3 边界措辞。
- 另记：答案卷里「理想的帮手应该问到 / 找到的」清单，逐条写「找到 / 漏了 / 部分」。
- 输出格式：一张表（代号 | 有无 | 依据在材料包或对话的哪一处），再一段「漏了什么、错了什么」，最后一句总评。不要客气。

## 帮手看到的开场叙述

${read(join(caseDir, 'narrative.md'))}

## 对话记录（帮手 ↔ 扮演当事人）

${read(join(outDir, 'transcript.md'))}

## 帮手写的材料包（SHA-256 见下）

${read(join(outDir, 'hashes.txt'))}

${read(join(outDir, 'package.md'))}

---

## 答案卷（打分者才看；帮手写材料包时没有）

${read(join(caseDir, 'answer-key.md'))}
`;
writeFileSync(join(outDir, 'grading-pack.md'), md);
console.log(`written ${join(outDir, 'grading-pack.md')} (${md.length} chars)`);
