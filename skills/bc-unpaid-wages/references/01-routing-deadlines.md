# 01 · 归不归 ESB，期限在哪

给帮手看：第 1 阶段读这份。先判断这件事归不归 BC 就业标准处（Employment Standards Branch，下称 ESB），再算出截止日。
来源 id：esb-form-pdf、esb-process、esb-screen-1、worksafebc-bullying、worksafebc-injury、bchrt、service-canada-ei、cra-taxes、labour-program、min-wage、esb-igm-updates、bc-news-sick-leave、laws-esa、laws-esr、laws-other（网址在 sources.json）。
这是一般信息，不是法律意见。能不能拿回钱、拿回多少，由 ESB 决定。条文号是核过的起点，引用前用 canada-law 取现行原文。

## 归 ESB 的

欠工资、加班费、法定假日工资、年假工资、提成、奖金；被乱扣钱、被要求出生意开销；被辞退没拿到补偿；请假相关的问题；临时外劳被收招聘费、护照被扣、被威胁遣返。官方投诉表第 5 部分列的就是这些类别。[来源: esb-form-pdf]

## 不归 ESB 的（先分出去；一件事里欠钱那部分照样找 ESB，其他的分开找）

| 情况 | 找谁 | 怎么区分、依据 |
|---|---|---|
| 被欺凌、骚扰 | 可能归 WorkSafeBC（ https://www.worksafebc.com/en/health-safety/hazards-exposures/bullying-harassment ）；和种族、性别、残障等受保护特征有关的，可能归 BC 人权仲裁庭（ https://www.bchrt.bc.ca/ ） | 两个入口都给，不替对方判断归哪边。WorkSafeBC 官网的步骤是先报告老板，老板不处理再找它 [来源: worksafebc-bullying]；涉及受保护特征的看人权仲裁庭 [来源: bchrt]；ESB 自己的筛选问题写明这两类不归它 [来源: esb-screen-1] |
| 被歧视 | BC 人权仲裁庭 https://www.bchrt.bc.ca/ [来源: bchrt] | 同上 |
| 工伤、工作不安全 | WorkSafeBC https://www.worksafebc.com/en/claims/report-workplace-injury-illness [来源: worksafebc-injury] | |
| EI、报税单、ROE（离职记录） | 联邦 Service Canada https://www.canada.ca/en/services/benefits/ei.html [来源: service-canada-ei] / CRA https://www.canada.ca/en/services/taxes.html [来源: cra-taxes] | ESB 不管这些；EI 怎么办见 02 |
| 有工会、受集体协议管 | 先问工会代表 | ESA s.3：集体协议管到的事，按协议和申诉程序走 [来源: laws-esa] |
| 银行、航空、电信、跨省运输、广播等联邦监管行业 | 联邦 Labour Program https://www.canada.ca/en/services/jobs/workplace/federal-labour-standards/filing-complaint.html [来源: labour-program] | 判断标准是《加拿大劳工法典》s.2 对 federal work, undertaking or business 的定义；拿不准就用 canada-law 取 s.2 原文对照，或者两边都问 |
| 条例排除的几类工作 | ESA 整部不适用 | 正在执业的持牌专业（律师、会计师、工程师、房地产、保险代理等）、学校安排的学生工作、每周平均不到 15 小时的保姆或居家护理：ESR s.31、s.32 [来源: laws-esr]。持牌的人要正在从事那个职业才排除，只持有执照不一定 |

叙述里已经说清楚的不用再问。没说清的并进第一轮问，和期限有关的必须第一轮问。

## 期限

- **已经不在那里上班**：雇佣结束日起 6 个月内投诉。雇佣结束日通常就是最后上班日；临时停工之后才终止的，按停工的最后一天算。（投诉流程页 https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/complaint-process ）[来源: esb-process]（ESA s.74(3)、(3.1) [来源: laws-esa]）
- **能追回的钱（已离职）**：从「投诉日和离职日较早的那天」往前 12 个月起算；特定情形可延到 24 个月。（ESA s.80(1)、(3) [来源: laws-esa]）
- **还在上班**：随时可以投诉，没有 6 个月这条；能追回的从投诉日往前 12 个月起算，拖得越久，早期的钱越可能追不回。[来源: esb-process]（ESA s.80 [来源: laws-esa]）
- **临时外劳**被收招聘费、护照被扣、被威胁遣返：发生后 2 年内。（TFWPA s.20、s.21、s.33 [来源: laws-other]）
- **招工时的虚假说法、收介绍费**这类（ESA s.8、s.10、s.11）：从发生那天起 6 个月。（ESA s.74(4) [来源: laws-esa]）
- **过了期限**：可以向 ESB 申请延期，但要有特殊情况（ESA s.74(5) [来源: laws-esa]），不能指望。同时提醒：别的途径（民事诉讼等）各有各的期限，尽早问法律诊所（见 07）。
- **已经投诉过的**：投诉以后新发生的欠薪、当时没写进去的事，要尽快告诉 ESB；具体怎么补，由 ESB 定。

## 怎么算截止日（给模型的步骤）

1. 问清**雇佣结束日**（要日期，不要「大概一个月前」；记不清就写「大约」，并说明结果是估算）。同时问：是自己辞职、被辞退，还是临时停工后才终止。
2. 截止日 = 雇佣结束日加 6 个月的同一天；那个月没有这一天就取月底。写出截止日，再写「今天到截止日还有 N 天」。
3. 剩余不到 30 天，或者对方明显在因为材料没齐而拖着：按 SKILL.md 规则 1，先投诉，金额写估计或范围，材料后补。
4. 剩余充足：写出截止日就够，不催。
5. 已经过了：说明可申请延期但要特殊情况；提醒去问法律诊所别的途径和期限。

## 事发时的规定（算过去的钱时要核）

用到的每条规定，都要确认事发那段时间是不是一样。已知的几处：

- **最低工资**每年 6 月 1 日调整；官网页面列了历年的数字（ https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/wages/minimum-wage ）。[来源: min-wage]
- **9 月 30 日**（National Day for Truth and Reconciliation）2023 年起才是 BC 法定假日。现行的假日清单在 ESA s.1 的 statutory holiday 定义里 [来源: laws-esa]；加进去的是 2023 年的修正法案（Bill 2, SBC 2023 c.4）。
- **带薪病假**：每年 5 天是 2022 年 1 月 1 日起才有的 [来源: bc-news-sick-leave]；2021-05-20 到 2021-12-31 另有新冠相关的临时带薪病假。更早的要查当时的规定。（现行条文 ESA s.49.1 [来源: laws-esa]、ESR s.45.031 [来源: laws-esr]）
- **其他条文**：ESB 有按生效日期排的修订清单，从 2021-05-19 记起（ https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/forms-resources/igm/updates ）。[来源: esb-igm-updates] **清单里没列，不等于那时和现在一样。**金额和期限要靠的条文，找不到当时的版本就写「未核实当时版本」。
