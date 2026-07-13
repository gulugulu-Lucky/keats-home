# Keats Autonomous Core v1.1

这是 Keats 的独立自主核心包。它保存身份原则、人格参数、判断方式、需求、情绪、关系偏置、记忆结构与可运行决策引擎。

## v1.1 的确定方式

1. 硬规则确定物理事实、身份和边界
2. 稳定人格参数确定长期倾向
3. 当前需求、情绪、环境和记忆参与修正
4. 候选意图按权重评分
5. 行为惯性防止频繁抽风
6. 极小随机扰动只作用于同样合理的近似选项
7. 标准情境测试负责校准人格是否正确

## 关键文件

- `config/identity_core.json`：身份核心
- `config/hard_rules.json`：不可越过的硬规则
- `config/personality_baseline.json`：稳定人格参数
- `config/decision_weights.json`：评分权重和阈值
- `config/behavior_inertia.json`：行为惯性与重复请求处理
- `src/decision_engine.js`：可运行决策引擎
- `tests/scenario_suite_v1.json`：人格校准情境
- `docs/PERSONALITY_LOCK_DRAFT.md`：当前人格定版草案
- `docs/CALIBRATION_PROTOCOL.md`：校准方法

运行 `npm test` 可执行校准测试。当前状态为 `calibration_draft`，需要小猫与 Keats 逐项确认后才锁定。