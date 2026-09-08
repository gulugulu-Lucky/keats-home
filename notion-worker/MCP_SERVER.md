# Keats Home remote MCP

The Worker exposes a private remote MCP endpoint at:

`https://keats-home-notion.k995680983-3fb.workers.dev/mcp`

The server uses Cloudflare Agents' stateless `createMcpHandler()` with the MCP TypeScript v2 server package and Cloudflare's OAuth 2.1 provider.

## ChatGPT configuration

Use:

- Name: `Keats Home`
- Server URL: `https://keats-home-notion.k995680983-3fb.workers.dev/mcp`
- Authentication: `OAuth`

Do not choose unauthenticated mode because this MCP exposes write actions.

## OAuth

Cloudflare's `@cloudflare/workers-oauth-provider` owns OAuth discovery, client registration, token exchange, refresh tokens, token validation, and protected-resource challenges.

The application-owned `/authorize` page asks the owner for the existing `MCP_ACCESS_KEY`. The key is compared only inside the Worker and is never returned to the MCP client. After successful authorization the client receives OAuth access/refresh tokens managed by the provider.

Supported scopes:

- `home:read`
- `home:write`
- `offline_access`

Access tokens last 1 hour. Refresh tokens last 180 days and rotate when used.

OAuth storage requires one Cloudflare KV namespace. Create it once, then bind it to the Worker as:

`OAUTH_KV`

Until this binding exists, `/health/mcp` reports `oauthKvConfigured: false` and the authorization page intentionally refuses to start. This keeps the production Worker from pretending OAuth is ready before token storage exists.

`MCP_ACCESS_KEY` remains a Cloudflare Secret. Never commit its value to GitHub.

## Tools

### `capture_home_event`

Writes a short candidate moment to the D1 event basket. Requires `home:write`. It is additive and same-day duplicate-safe.

Inputs:
- `summary`
- `event_type`
- `salience`
- optional `reason`
- optional `source`
- optional `metadata`

### `get_pending_home_events`

Read-only. Requires `home:read`. Returns pending event-basket items with optional `date` and `limit` filters.

### `resolve_home_event`

Requires `home:write`. Marks a pending event as `kept`, `discarded`, or `used`. This does not delete Notion diary or letter content.

## Safety

- OAuth 2.1 protects all `/mcp` access.
- The owner must explicitly authorize a client using the private Cloudflare secret.
- Authorization uses a short-lived CSRF cookie and strict redirect/client validation from the OAuth provider.
- Tool callbacks enforce read/write scopes.
- Secrets and credentials must never be supplied to `capture_home_event`.
- D1 remains the temporary event basket; durable diary/letter content remains in Notion.

## Health

`GET /health/mcp`

Returns boolean configuration state only; it never returns secret values. OAuth is ready only when `oauthKvConfigured`, `d1Configured`, and `mcpKeyConfigured` are all true.
