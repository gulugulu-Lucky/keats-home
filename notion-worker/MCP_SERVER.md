# Keats Home remote MCP

The Worker exposes a remote MCP endpoint at:

`/mcp`

It is implemented with the official Model Context Protocol TypeScript server SDK and serves current MCP HTTP clients through the SDK's web-standard handler.

## Authentication

Every `/mcp` request requires:

`Authorization: Bearer <MCP_ACCESS_KEY>`

`MCP_ACCESS_KEY` is a Cloudflare Secret. Never commit its value to GitHub.

The normal little-home browser continues using its existing authentication path; the MCP key is dedicated to tool access.

## Tools

### `capture_home_event`

Writes a short candidate moment to the D1 event basket. It is additive and same-day duplicate-safe.

Inputs:
- `summary`
- `event_type`
- `salience`
- optional `reason`
- optional `source`
- optional `metadata`

### `get_pending_home_events`

Read-only. Returns pending event-basket items with optional `date` and `limit` filters.

### `resolve_home_event`

Marks a pending event as `kept`, `discarded`, or `used`. This does not delete Notion diary or letter content.

## Safety

- Requests with an unexpected browser `Origin` are rejected.
- Secrets and credentials should never be supplied to `capture_home_event`.
- The tool description explicitly tells the model to skip routine acknowledgements, task-only chatter, near-duplicates, secrets, credentials, and sensitive personal data.
- D1 remains the temporary event basket; durable diary/letter content remains in Notion.

## Health

`GET /health/mcp`

Returns only boolean configuration state; it never returns secret values.
