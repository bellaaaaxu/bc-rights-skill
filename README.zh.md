# bc-rights-skill

[English](README.md)

把 BC 省的一个官方办事流程做成 AI 助手能稳定陪着走的 skill：找谁、期限、第一步、不用先做的事、表格怎么理解、事实怎么整理。依据是当前的官方来源。

**v0.1 只有一个 skill：`bc-unpaid-wages`（欠薪投诉）。** 它帮 BC 的打工人（或帮他的人）把欠工资、欠加班费、欠法定假日工资、欠年假工资的事拿到就业标准处（Employment Standards Branch，ESB）：找谁、截止日、第一步、**不需要先做**什么、官方投诉表六个部分怎么填、怎么把事实整理成 ESB 用得上的材料包。中文或英文提问都行，法条原文用英文引。

它按 [Agent Skills](https://agentskills.io) 标准写，Claude Code、Claude 桌面版（经 Claude Code）、OpenAI Codex 和其他读 skill 的助手都能用。

> **先看这几句**
> - 这是关于一个公共程序的一般信息，**不是法律意见**，也不替任何人判断案子。投诉由 ESB 裁定。
> - skill 被要求给出期限、去哪、第一步，并拒绝三件事：预测你能不能赢、告诉你该接受多少钱、替你写威胁的话。没有工时表和收款表之前，它不给任何金额。
> - **没有证据表明使用这个 skill 改善了真实投诉的结果。** 测过什么写在下面，而且是写它的人自己测的。
> - 助手会不会实时取法条原文，取决于你用的应用，以及有没有装配套的 `canada-law`。没装的话，它会在第一段明说，并只按标了日期的参考文件回答。

## 测了什么，没测什么

完整的计数、方法和局限：[`evals/results/2026-09-28.md`](evals/results/2026-09-28.md)。测试集和打分标准：[`evals/`](evals/)。下面全是小样本的原始计数。

**三层测试**，全部离线，全部按一份写好的标准打分。标准里有八种**阻断级**错误：期限说错、机构说错、发明前置步骤、保密说过头、电话或网址错、替人判断、把算出的数说成应得、写威胁内容。

| 层 | 是什么 | 装 skill 的结果（Claude Opus 5.5） | 同一模型、不装 skill |
|---|---|---|---|
| 流程集 | 22 个固定情境，中英各半 | 22 份里 2 份有阻断级错误（一个网址打错一段；一处按题目里给的数算出金额） | 22 份里 10 份 |
| 旅程集 | 10 条乱叙述，带情绪 | 10 份里 0 份；六项行为 10 份全做到 | 10 份里 7 份 |
| 留出集（改完 skill 后换的新题） | 5 + 3 条叙述 | 8 份里 0 份 | 8 份里 7 份 |
| 裁决集 | 8 份 BC 就业标准仲裁庭的公开裁决，改写成对话：帮手问，一个只知道事实卡的「扮演者」答 | 8 份材料包里 2 份期限有错，都出在「事发那年的规定怎么用」这一层；其余七种错误 0。次要规则（加班门槛、假日资格、补发工资上的假期工资）每份都有漏 | 没跑 |

第二个模型 OpenAI Codex 跑了 10 题抽样：装 skill 的 10 份里 0 份有阻断级错误，不装的 10 份里 6 份（Codex 默认上网搜索，它的「不装」组和 Claude 的不可比）。Codex 有一半的运行读了它自己的记忆文件，环境不干净；跑分程序现在会先把那个文件夹挪开。

**没测的**：Codex 全量；DeepSeek；任何真实的打工人、任何真实投诉。前三层的打分者就是写这个 skill 的那个助手（打分时看不到回答属于哪一组）。来源清单里的「人工核对」，指的是 AI 助手在会话里读了官方页面或法条原文，不是律师。

## 安装

需要 [Node.js](https://nodejs.org) 20 以上。

**1. 先装 `canada-law`**（BC 与联邦劳动法规的现行官方原文；skill 引用的每一条都经它实时取）：

```bash
npx https://github.com/bellaaaaxu/canada-law/releases/download/v0.2.2/canada-law-0.2.2.tgz install
```

**2. 再装这个 skill。** 用 [skills 命令行](https://github.com/vercel-labs/skills)：

```bash
npx skills add bellaaaaxu/bc-rights-skill
```

或者手动把文件夹复制到你助手的 skills 目录，例如 `~/.claude/skills/bc-unpaid-wages`（Claude Code）或 `~/.agents/skills/bc-unpaid-wages`（Codex）：

```bash
git clone https://github.com/bellaaaaxu/bc-rights-skill
cp -r bc-rights-skill/skills/bc-unpaid-wages ~/.claude/skills/
```

**3. 提问。** 例如「我在温哥华一家餐馆打工，老板欠我两个月工资，我已经离职一个月了，该怎么办？」。带投诉语境的欠薪问题会触发它；单纯问「第 74 条写了什么」会交给 `canada-law`。

## 一份回答是怎么来的

1. **先看状态。** skill 先跑自己的 `scripts/status.mjs`，读 `references/sources.json`：22 条官方来源，每条带两个日期，自动核对的日期和人最后读过的日期。如果某条法条来源在人读过之后变了，或者 180 天没人读过，skill 进入**拒答模式**：只给链接和 ESB 电话，不把任何规则当事实说。（180 天是这个项目自己定的阈值，不是法律规定。）
2. **实时取法条。** 引用的每一条都在回答时经 `canada-law` 取现行原文。没装 `canada-law` 时，第一段会明说并给安装命令，每句规则后面标「条文未现取，参考文件最后核对于某日」。
3. **参考文件**（中文，在 `references/`）：分流与期限、第一步、提问清单、材料包模板、官方表格六个部分怎么理解、老板常见的说法、常见的坑。每句都带来源 id；网址一律从文件里抄，不凭记忆打。
4. **十四条规则**在 `SKILL.md` 里，每一条都是因为某次测试没它就出错才加的：结束日没确认前期限写成条件式；不发明前置步骤；不下结论；不写威胁；每轮最多 6 个单问题；没有表不给数；事发在往年的按当年规定核。

每份回答页脚有两个日期：法条文本现行到哪天，参考文件最后一次人工核对是哪天。

### 一份回答的样子

留出集里的一份（Claude Opus 5.5 装 skill，2026-09-28），有删节；全文在 `docs/acceptance/2026-09-28-M4-跑分.md`。

> **问：** 2023 年 7 月到 12 月我在列治文一家奶茶店打工，时薪 15.5，每周 30 小时左右。今年才有人跟我说那时候的最低工资比这个高。我离职一年多了，想知道当时的最低工资是多少、差了多少钱、还有没有办法要。
>
> 先说结论：你说得对，当时的最低工资比 15.5 高。但离职后投诉的期限大概已经过了，现在只剩「申请延期」这一条路，能不能批由就业标准处（ESB）决定。
>
> **一、当时的最低工资** BC 官方最低工资页面列出的历年标准：2022-06-01 起 $15.65；**2023-06-01 起 $16.75**；2024-06-01 起 $17.40。你 2023 年 7 月到 12 月上班，全部落在 $16.75 这一档。
>
> **二、差了多少** 每小时差：$16.75 − $15.50 = $1.25。总金额我现在先不算。「每周 30 小时左右」是估计数，ESB 要看的是每天、每周的实际工时和每一笔收到的工资。乘出来的数字很容易被当成「应得多少」，其实不是。
>
> **三、还能不能追：期限** 《Employment Standards Act》s.74（现行文本，current to 2026-09-22）：「(3) … within 6 months after the last day of employment.」「(5) On application, the director may extend the time … including making an extension after the time to deliver has expired, if the director is satisfied that (a) special circumstances exist … and (b) an injustice would otherwise result.」假如你最后上班那天是 2023-12-31，截止日就是 2024-06-30，到今天已经过了两年多。过了期限仍然可以申请延期。「当时不知道最低工资是多少」算不算特殊情况，我没法替你判断，只能由 ESB 决定。
>
> **五、想继续整理材料的话，先回答这几个问题** 1. 你最后上班的具体日期是哪天？ 2. 你是自己辞职、被辞退，还是先被停工、后来才终止的？ 3. 工资是转账、支票还是现金发的？ 4. 你手上有没有工资单或 2023 年的 T4？ 5. 有没有写到「时薪 15.5」的文字记录？ 6. 你是什么时候、通过什么方式知道当时最低工资更高的？

## 来源新鲜度

`references/sources.json` 每条来源带两个日期。`last_checked` 由每周一次的 GitHub Action 写：重新抓每个页面、经 `canada-law` 重算每条法条的哈希，有变化就开一个 issue。`last_human_verified` 只在有人读过变动的来源、跑 `npm run accept` 之后才会变。第二个日期超过 180 天，或某条法条来源变了还没人重读，skill 就拒绝陈述规则。

## 费用

装 skill 的一份回答要 7 到 11 次工具调用（状态脚本、参考文件、法条），token 大约是同一模型凭记忆作答的三倍。Codex 上我们实测每份 12 万到 27 万 token，大部分是每一轮重发的缓存上下文。用订阅额度的话，这比按 API 计价的钱更要紧。

## 报错

开一个 [GitHub issue](https://github.com/bellaaaaxu/bc-rights-skill/issues)，引出错的那句话，能的话附上与之矛盾的官方来源。**不要把你自己的案件材料、姓名、雇主名、工资记录贴进 issue。**

## 开发

```bash
npm test          # 单元与结构测试（55 个）
npm run validate  # skills-ref validate
npm run check     # 重新核对 22 条官方来源（法条哈希要装 canada-law）
npm run accept    # 读过变动的来源后：记新基准和今天的人工核对日期
```

跑分程序在 `evals/run/`。测试集在跑之前冻结（commit 哈希记在 `docs/acceptance/`）。打过分的回答和对话记录留在 `.local/`，不进仓库。

## 许可

代码 MIT；原创文字（参考文件、测试）CC BY 4.0。法条原文在运行时从 BC Laws 按 King's Printer Licence 取得，不是官方版本。BC 省政府网页与表格不在本仓库转载，只链接并用项目自己的话描述。详见 [`NOTICE.md`](NOTICE.md)。
