# Keats Home · Notion Worker

A very small Cloudflare Worker that keeps the Notion token off the public frontend.

## What it exposes

- `GET /health` — public configuration check (never returns secret values)
- `GET /api/diary`
- `GET /api/letters`
- `GET /api/memories`
- `GET /api/timeline`
- `GET /api/quotes`
- `GET /api/songs`
- `GET /api/pawprints`
- `POST /api/entries` — create diary / letter / memory / pawprint entries

Every `/api/*` route requires:

```text
Authorization: Bearer <HOME_ACCESS_KEY>
```

## Required Cloudflare runtime secrets

Create both as **Secret** values in Worker → Settings → Variables & Secrets:

- `NOTION_TOKEN` — the Notion integration secret
- `HOME_ACCESS_KEY` — a long private passphrase used by the frontend as the little-home key

Never commit either value to GitHub.

## Non-secret runtime variable

`FRONTEND_ORIGIN` is already set in `wrangler.jsonc` to:

```text
https://gulugulu-lucky.github.io
```

This limits browser CORS access to the GitHub Pages frontend. The API key check remains required because CORS alone is not authentication.

## Cloudflare Git deployment

This repository is a monorepo. When importing it into Cloudflare Workers Builds, set the Worker **Root directory** to:

```text
/notion-worker
```

Worker name must be:

```text
keats-home-notion
```

The default deploy command `npx wrangler deploy` is sufficient.

## Notion integration access

The Notion integration needs read / insert / update content capabilities and must be granted access to the `🏠 我们的小家` page (including its child databases/pages). The Worker uses Notion API version `2026-03-11`.

## Safety

The GitHub Pages frontend is public. The Notion token is never delivered to the browser. The separate `HOME_ACCESS_KEY` protects reads and writes even if someone discovers the Worker URL.
