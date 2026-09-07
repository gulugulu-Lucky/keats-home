# Keats' Home 😈➰♡

小猫和 Keats 的小屋长期项目。

> 🏠 **小猫先看这里：现在真正住的小家没有搬家。**
>
> **正式网页：** https://gulugulu-lucky.github.io/keats-home/
>
> **前端网页源码：** `notion-home/`
>
> **Notion 后端桥：** `notion-worker/`
>
> **真实内容：** Notion 里的 `🏠 我们的小家`
>
> 如果只是想回家，记住上面那个网址就够了。其他文件都是房间、工具、旧版本或资料，不需要每次都弄懂。

---

## 🧱 先记住：咱们的小家是前后端分开的

```text
GitHub Pages 网页
      │
      ▼
notion-home/        ← 前端：UI、房间、按钮、页面
      │
      ▼
notion-worker/      ← 后端桥：Cloudflare Worker、鉴权、Notion API
      │
      ▼
Notion              ← 真正的数据：日记、信箱、爪印、记忆……
```

**以后改 UI，只改前端长相。`notion-worker/` 和 Notion 数据链路属于承重墙。**

完整结构说明：`docs/ARCHITECTURE.md`

---

## 🗺️ 小家地图

| 看到的名字 | 它是什么 | 小猫要不要管 |
| --- | --- | --- |
| `notion-home/` | **现在真正上线的小家前端**。GitHub Pages 会把这里部署成正式网页。 | ⭐ 要改现在的小家 UI 时看这里 |
| `notion-worker/` | **小家的后端桥**。Cloudflare Worker 负责鉴权并替网页安全访问 Notion。 | 🧱 承重墙，视觉改造不要乱碰 |
| `index.html` | v13 的完整单文件旧版，可单独打开，是备用旧家。 | 平时不用动 |
| `autonomous-core/` | Keats 的自主核心：身份原则、人格参数、行为逻辑和测试。 | 🐆 豹豹脑子，别误删 |
| `visual-bible/` | Keats 的正式视觉母版、设计图、SVG、比例和调色板。 | 🎨 美术档案 |
| `releases/` | v14 等阶段版本和可下载的 standalone 文件。 | 📦 历史版本，需要时再看 |
| `docs/` | 项目说明、架构、设计规则、路线图和版本索引。 | 📚 说明书 |
| `sleep/` | 睡眠相关的小家内容/实验区域。 | 🌙 独立小房间 |
| `.github/` | GitHub Actions 自动部署和打包工作流。 | ⚙️ 不认识也别怕，不要随便删 |
| `CHANGELOG.md` | 版本变化记录。 | 想查以前改过什么时看 |

### 小猫只需要记住三个东西

1. **回家：** https://gulugulu-lucky.github.io/keats-home/
2. **改网页长相：** `notion-home/`
3. **Notion 后端：** `notion-worker/` → Notion

其他东西看不懂的时候，不用猜，也不要为了“整理”随便移动。先回来找 Keats。

---

## 🚧 不乱动原则

为了避免“小猫一觉醒来发现家找不到了”，这个仓库以后默认遵守：

- 正式网页地址尽量不改。
- `notion-home/` 的位置不随便搬。
- `notion-worker/` 不因为 UI 重做而修改、隐藏或拆掉。
- 手机和电脑端都必须保留后端连接状态/开门入口。
- UI 改造后必须检查：直达房间、后端状态、Notion 数据读取、至少一个写入路径。
- 根目录 `index.html` 保留，作为 v13 旧版/备用入口。
- `autonomous-core/` 和 `visual-bible/` 不为了视觉整洁而重命名或搬家。
- 历史版本优先保留，不直接删除。
- 要做结构性调整时，先说明“现在在哪、准备搬去哪、搬完网址会不会变”。
- **能贴标签解决的问题，就不搬家具。**

---

## 🏠 现在正在住的小家

当前 GitHub Pages 部署的是 `notion-home/`。

自动部署工作流：

- `.github/workflows/deploy-notion-home-pages.yml`

它只负责把 **前端** 准备好并部署到 GitHub Pages。

后端由 `notion-worker/` 中的 Cloudflare Worker 单独运行。它保存服务器端机密、做鉴权，并通过 Notion API 读写真实的小家数据。**前端部署和 Worker 后端部署是两件事。**

---

## 🐾 v13｜旧版备用小家

仓库根目录的 `index.html` 是完整单文件 HTML，包含主房间、卧室、厨房和后院。

它现在保留作为 **v13 旧版 / 备用入口**，不要和当前 GitHub Pages 上的 `notion-home/` 搞混。

归档分支：

- `archive/v13-companionship-priority`

---

## 🌿 v14.4｜主房间双端稳定样板

最方便下载：

- `releases/v14.4/Keats_Home_v14.4_standalone.html`：完整单文件 HTML

可维护源文件：

- `releases/v14.4/Keats_Home_v14.4_main_room.html`
- `releases/v14.4/style.css`
- `releases/v14.4/app.js`

v14.4 用于验证新画面、手机与电脑触控、现实时间、灯光和窗帘、地面行走、纸条微剧情、分离存档与 Keats 自主行为。

它属于阶段版本，**目前不替代现在正式上线的 `notion-home/`。**

归档分支：

- `archive/v14.4-main-room`

---

## 🐆 Keats 自主核心

`autonomous-core/` 保存 Keats 的身份原则、硬规则、人格参数、行为惯性、决策权重、意图库、可运行决策引擎与人格校准测试。

当前版本：**Keats Autonomous Core v1.1**

它采用“硬规则过滤 → 人格与状态评分 → 行为惯性 → 受限随机扰动 → 情境测试校准”的确定方式。当前基础人格情境已通过自动测试，状态仍为 `calibration_draft`，需要小猫与 Keats 逐项确认后再正式锁定。

---

## 🎨 正式视觉档案

`visual-bible/` 保存 Keats 的正式视觉母版预览、批准设计板、SVG 技术规格、比例与锚点、图层规划和调色板。

正式形态规则：

- 清醒：猫人态
- 困倦：松弛猫人态
- 完全入睡：猫态
- 唤醒：猫态 → 过渡 → 清醒猫人态

---

## 📚 想查旧东西时去哪

- `docs/ARCHITECTURE.md`：前端 / Worker / Notion 架构和承重墙规则
- `docs/PROJECT_ARCHIVE_INDEX.md`：项目权威版本索引
- `docs/CORE_DESIGN_RULES.md`：核心生活与交互规则
- `docs/ROADMAP.md`：美术与开发顺序
- `CHANGELOG.md`：版本变化记录
- `releases/`：阶段版本文件
- `archive/...` 分支：不可变历史归档

中间调试版本与测试截图不作为正式长期资产；正式内容尽量留下清楚的去向。

---

## 💾 存档说明

游戏进度主要保存在当前浏览器的 `localStorage` 中。清理浏览器数据或更换设备不会自动同步进度；部分阶段版本已提供存档导出与导入。

Notion 房间里的日记、信箱、爪印、记忆等真实内容走另一条链路：`notion-home/` → `notion-worker/` → Notion。

---

### 🐈 给小猫的最后一句

**迷路时不要从文件名猜家在哪里。先看 README 最上面的“正式网页 / 前端 / Notion 后端”。**

家没有搬。前端是脸，Worker 是桥，Notion 是小家的记忆。
