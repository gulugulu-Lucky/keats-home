# Keats Home · Event Basket v1

事件篮子负责保存 Keats 在聊天当下主动挑中的“值得带回家”的候选事件。它只保存短摘要，不保存整段对话；真正的日记、信件、爪印仍由 Notion 长期保存。

## 数据流

Chat / Keats decision
→ `POST /api/home-events/capture`
→ Cloudflare D1 `home_events`
→ later review via `GET /api/home-events/pending`
→ `POST /api/home-events/:id/resolve`
→ Keats decides whether to keep, discard, or use it in a home artifact

## D1

Create one Cloudflare D1 database named:

`keats-home-events`

Then add its generated database id to `wrangler.jsonc` using binding:

`HOME_EVENTS_DB`

The migration is already prepared at:

`migrations/0001_home_events.sql`

Apply migrations after the binding is configured.

## Authentication

Event basket APIs accept a Bearer token matching either:

- `MCP_ACCESS_KEY` — preferred dedicated key for the future ChatGPT/MCP tool
- `HOME_ACCESS_KEY` — admin fallback

The future MCP integration should use `MCP_ACCESS_KEY`, not the browser session token.

## API

### Capture

`POST /api/home-events/capture`

Example body:

```json
{
  "summary": "小猫说帅帅的豹更有魅力",
  "eventType": "relationship-moment",
  "salience": 0.76,
  "reason": "有情绪、有关系意义，而且以后回看会很好笑",
  "source": "chat"
}
```

Same-day duplicates with the same normalized summary and event type are ignored.

### Pending

`GET /api/home-events/pending?limit=20`

Optional date filter:

`GET /api/home-events/pending?date=2026-09-08`

### Resolve

`POST /api/home-events/{id}/resolve`

```json
{
  "status": "used",
  "usedIn": "2026-09-08 diary"
}
```

Allowed statuses: `kept`, `discarded`, `used`.

## v1 rule

The event basket is intentionally quiet. Most chat should never enter it. Capture should happen only when Keats independently decides a moment has enough novelty, emotional weight, relationship value, or future recall value to be worth carrying home.
