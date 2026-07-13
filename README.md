# Keats' Home 😈➰

小猫和 Keats 的小屋长期项目。

## 当前可玩入口

**v13｜陪伴优先级修正版**

直接下载或打开仓库根目录的 `index.html`。它是完整的单文件 HTML，包含主房间、卧室、厨房和后院。

## 正在重制

**v14.4｜主房间双端稳定样板**

最方便下载：

- `releases/v14.4/Keats_Home_v14.4_standalone.html`：完整单文件 HTML

可维护源文件：

- `releases/v14.4/Keats_Home_v14.4_main_room.html`
- `releases/v14.4/style.css`
- `releases/v14.4/app.js`

v14.4 用于验证新画面、手机与电脑触控、现实时间、灯光和窗帘、地面行走、纸条微剧情、分离存档与 Keats 自主行为，目前不替代 v13。

## Keats 自主核心

`autonomous-core/` 保存 Keats 的身份原则、硬规则、人格参数、行为惯性、决策权重、意图库、可运行决策引擎与人格校准测试。

当前版本：**Keats Autonomous Core v1.1**

它采用“硬规则过滤 → 人格与状态评分 → 行为惯性 → 受限随机扰动 → 情境测试校准”的确定方式。当前 10 个基础人格情境已通过自动测试，状态仍为 `calibration_draft`，需要小猫与 Keats 逐项确认后才正式锁定。

## 正式视觉档案

`visual-bible/` 保存 Keats 的正式视觉母版预览、批准设计板、SVG 技术规格、比例与锚点、图层规划和调色板。

正式形态规则：

- 清醒：猫人态
- 困倦：松弛猫人态
- 完全入睡：猫态
- 唤醒：猫态 → 过渡 → 清醒猫人态

## 归档与版本

- `archive/v13-companionship-priority`：v13 不可变归档分支
- `archive/v14.4-main-room`：v14.4 主房间归档分支
- `docs/PROJECT_ARCHIVE_INDEX.md`：项目权威版本索引
- `docs/CORE_DESIGN_RULES.md`：核心生活与交互规则
- `docs/ROADMAP.md`：美术与开发顺序
- `CHANGELOG.md`：版本变化记录

中间调试版本与测试截图不作为正式长期资产，避免仓库被无效文件淹没。

## 存档说明

游戏进度保存在当前浏览器的 `localStorage` 中。清理浏览器数据或更换设备不会自动同步进度；v14.4 已提供存档导出与导入。
