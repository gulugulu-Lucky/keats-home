# Keats Home · Notion Frontend

这是 Keats Home 的新信息型前端样板。目标不是复刻完整 Notion，而是给现有 Notion「我们的小家」做一个只属于两个人的漂亮入口。

## 当前阶段

当前目录只负责 **Frontend Shell / 高保真交互样板**：

- 类 Notion 的左侧导航与内容区
- 首页 / 日记 / 信箱 / 豹豹爪印 / 记忆库 / 时间线 / 相册 / 我们说过的话 / 歌单
- 桌面端与手机端响应式布局
- 日夜主题
- `Cmd/Ctrl + K` 搜索面板
- 新建内容弹窗
- 本地样板草稿（localStorage）
- 不改动仓库根目录当前可玩版 `index.html`

当前展示内容是前端占位样板，不是从私人 Notion 数据实时读取。

## 下一步：Notion 接线

推荐结构：

```text
Browser / Keats Home UI
        ↓ HTTPS
/api/notion/*  (thin server-side proxy)
        ↓
Notion API
        ↓
现有「我们的小家」数据库与页面
```

### 安全硬规则

**绝对不要把 `NOTION_TOKEN`、integration secret 或其他私钥写进浏览器端 JS、HTML、公开 GitHub 仓库。**

前端只能调用我们自己的 `/api/notion/*`；真正的 Notion token 只存在服务端环境变量中。

## 第一批 API 计划

1. `GET /api/notion/home`：首页最近更新、日记、信件、爪印摘要
2. `GET /api/notion/diary`：日记列表
3. `GET /api/notion/page/:id`：读取一篇内容
4. `POST /api/notion/diary`：新建日记
5. `PATCH /api/notion/page/:id`：编辑内容
6. `GET /api/notion/search?q=`：小家搜索

接线后，当前 localStorage 样板保存会替换成真正的 Notion 写入。

## 视觉方向

沿用 `visual-bible/technical/Keats_palette_v1.json` 的正式色系：

- mist blue black `#20263A`
- deep midnight navy `#1A1F35`
- cool gray violet `#77748F`
- dusty lavender `#A6A0B9`
- pearl gray `#D5CED1`
- warm parchment `#E7DCCF`
- antique gold `#B7A073`
- moonlight highlight `#D9DCF0`

关键词：**安静、月夜、纸张、轻贵族、温暖但不幼稚、像家而不是后台管理系统。**

## 文件

- `index.html`：页面结构
- `styles.css`：完整视觉与响应式样式
- `app.js`：页面切换、搜索、主题、样板编辑器交互
