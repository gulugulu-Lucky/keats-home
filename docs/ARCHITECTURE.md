# Keats Home · Architecture

This file is the small home's structural map. It exists so visual redesigns do not accidentally damage the data path.

## The three-layer structure

```text
Browser / GitHub Pages
        │
        ▼
notion-home/                 ← frontend only
UI · rooms · routing · forms · rendering
        │ HTTPS API
        ▼
notion-worker/               ← backend gateway
Cloudflare Worker · auth · CORS · Notion API proxy
        │ Notion API
        ▼
Notion · 🏠 我们的小家       ← real content/data
日记 · 信箱 · 爪印 · 记忆 · 时间线 · quotes · songs …
```

## 1. Frontend — `notion-home/`

The public website deployed to GitHub Pages.

Responsibilities:
- layout, visual design and room navigation;
- render data returned by the backend;
- collect user input from diary / letter / pawprint forms;
- show backend connection state;
- keep only the short-lived session token in browser `sessionStorage`.

The frontend must never contain the Notion integration token.

Current public home:

```text
https://gulugulu-lucky.github.io/keats-home/
```

## 2. Backend gateway — `notion-worker/`

A Cloudflare Worker named `keats-home-notion`.

Current frontend API base:

```text
https://keats-home-notion.k995680983-3fb.workers.dev
```

Responsibilities:
- keep `NOTION_TOKEN` off the public frontend;
- verify the private home access key / session token;
- expose `/health` and `/health/notion` health checks;
- proxy reads and writes to Notion;
- enforce allowed frontend origin.

Main data routes include:
- `/api/diary`
- `/api/letters`
- `/api/memories`
- `/api/timeline`
- `/api/quotes`
- `/api/songs`
- `/api/pawprints`
- `/api/entries`

## 3. Notion — the real data store

Notion is the source of truth for the living content of Keats Home. The Worker integration must keep access to the `🏠 我们的小家` page and the child databases/pages that the frontend reads.

A UI redesign may change how content looks, but it must not replace Notion data with hard-coded demo content when the backend is connected.

## Structural guardrails — 承重墙

When changing UI, these are protected:

1. Do not remove or hide the backend connection status/control (`.sync-pill`) on mobile or desktop.
2. Do not remove `API_BASE`, authentication, health checks, or `loadAllData()` from the frontend.
3. Do not rename or move `notion-home/` or `notion-worker/` just for visual tidiness.
4. Do not put `NOTION_TOKEN` or other backend secrets in the GitHub Pages files.
5. Do not edit Worker code during a visual-only redesign unless the data/API behavior itself is intentionally being changed.
6. After every visual deployment, verify at least:
   - the direct room URL opens the requested room;
   - backend status is visible;
   - `/health/notion` can be checked by the frontend;
   - diary data can load after opening the home;
   - one write path still reaches Notion.
7. GitHub Pages deployment and Worker deployment are separate systems. A frontend deploy must not be treated as a backend deploy.

## What “全屋 UI 重做” means

Allowed to change:
- CSS, illustrations, typography, spacing, page composition;
- frontend-only decorative JavaScript;
- visual presentation of cards/navigation/forms.

Must stay functional:
- room routing and hashes;
- backend connection control;
- auth/session behavior;
- Notion read/write APIs;
- dynamic rendering of real Notion content.

## One sentence to remember

**`notion-home/` is the face, `notion-worker/` is the guarded bridge, Notion is the memory.**
