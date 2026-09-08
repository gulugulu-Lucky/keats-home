# Keats Autonomous Core v1.2

这是 Keats 的独立自主核心包。它保存身份原则、人格参数、判断方式、需求、情绪、关系偏置、记忆结构与可运行决策引擎。

## v1.2 的确定方式

1. 硬规则确定物理事实、身份和边界
2. 稳定人格参数确定长期倾向
3. 当前需求、情绪、环境和记忆参与修正
4. 主行为继续按候选意图权重评分
5. 行为惯性防止频繁抽风
6. 极小随机扰动只作用于同样合理的近似选项
7. `evaluateHomeCapture()` 单独判断“这一刻要不要带回小家”
8. 小家记录判断不会和正常回应抢同一个主行为槽位
9. 普通确认、纯任务内容、近似重复会主动降权；敏感信息直接跳过
10. 标准情境测试负责校准人格与记录判断是否正确

## 小家事件判断

`evaluateHomeCapture(candidate)` 输出三种结果：

- `skip`：放过去
- `basket`：放入 D1 事件篮子，之后再整理
- `priority_basket`：关系意义或未来回看价值较高，优先放入事件篮子

它综合新鲜度、情绪重量、关系意义、未来回看价值，以及 Keats 自己想不想留下这件事。它只决定“要不要捡”，并不直接写长信或日记。

## 关键文件

- `config/identity_core.json`：身份核心
- `config/hard_rules.json`：不可越过的硬规则
- `config/personality_baseline.json`：稳定人格参数
- `config/decision_weights.json`：主行为与小家记录的评分权重、阈值
- `config/behavior_inertia.json`：行为惯性与重复请求处理
- `src/decision_engine.js`：主行为决策与小家记录判断
- `tests/scenario_suite_v1.json`：人格校准情境
- `tests/run_calibration.mjs`：主行为 + 小家记录自动校准
- `docs/PERSONALITY_LOCK_DRAFT.md`：当前人格定版草案
- `docs/CALIBRATION_PROTOCOL.md`：校准方法

运行 `npm test` 可执行校准测试。当前状态仍为 `calibration_draft`；v1.2 先增加“这个我要带回家”的独立判断，不改变原有主行为人格框架。
