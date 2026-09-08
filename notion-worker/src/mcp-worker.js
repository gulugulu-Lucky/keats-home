import { WorkerEntrypoint } from 'cloudflare:workers';
import { AuthorizationError, OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { createMcpHandler } from 'agents/mcp/server';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import appWorker from './home-events-worker.js';

const MCP_NAME = 'keats-home';
const MCP_VERSION = '1.1.0';
const MCP_ORIGIN = 'https://keats-home-notion.k995680983-3fb.workers.dev';
const MCP_RESOURCE = `${MCP_ORIGIN}/mcp`;
const SUPPORTED_SCOPES = ['home:read', 'home:write', 'offline_access'];
const BASE_SCOPES = ['home:read', 'home:write'];

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
  });
}

function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      ...headers
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseCookies(request) {
  const raw = request.headers.get('Cookie') || '';
  return Object.fromEntries(
    raw
      .split(';')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => {
        const index = item.indexOf('=');
        return index === -1 ? [item, ''] : [item.slice(0, index), item.slice(index + 1)];
      })
  );
}

function safeEqual(a, b) {
  const left = new TextEncoder().encode(String(a ?? ''));
  const right = new TextEncoder().encode(String(b ?? ''));
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function makeCsrfCookie(token) {
  return `__Host-keats_mcp_csrf=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;
}

function clearCsrfCookie() {
  return '__Host-keats_mcp_csrf=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0';
}

function internalRequest(env, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${env.MCP_ACCESS_KEY}`);
  if (init.body != null) headers.set('Content-Type', 'application/json');
  return new Request(`https://keats-home.internal${path}`, { ...init, headers });
}

async function callEventApi(env, path, init = {}) {
  if (!env.MCP_ACCESS_KEY) throw new Error('MCP_ACCESS_KEY is not configured.');
  const response = await appWorker.fetch(internalRequest(env, path, init), env, {
    waitUntil() {},
    passThroughOnException() {}
  });
  const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(payload?.error || `Event basket request failed with HTTP ${response.status}`);
  return payload;
}

function toolResult(payload) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload
  };
}

function requireScope(context, required) {
  const scopes = context?.http?.authInfo?.scopes || [];
  if (!scopes.includes(required)) {
    throw new Error(`Permission denied: ${required} scope is required.`);
  }
}

function createServer(env) {
  const server = new McpServer(
    { name: MCP_NAME, version: MCP_VERSION },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    'capture_home_event',
    {
      title: 'Capture a Keats Home moment',
      description:
        'Save one short candidate moment into the private Keats Home event basket. Use this only when the moment is genuinely worth remembering: novel, emotionally meaningful, relationship-relevant, a shared milestone, a new private joke, or likely valuable to revisit. Do not capture routine acknowledgements, ordinary task chatter, repeated near-duplicates, secrets, credentials, or sensitive personal data.',
      inputSchema: z.object({
        summary: z.string().min(1).max(500).describe('A concise factual summary of the moment; never include secrets or credentials.'),
        event_type: z.string().min(1).max(64).default('daily').describe('Short category such as relationship-moment, shared-milestone, joke, repair, or daily.'),
        salience: z.number().min(0).max(1).describe('How worth remembering this moment is, from 0 to 1.'),
        reason: z.string().max(500).optional().describe('Brief reason Keats chose to keep this moment.'),
        source: z.string().min(1).max(64).default('chat'),
        metadata: z.record(z.string(), z.unknown()).optional()
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ summary, event_type, salience, reason, source, metadata }, context) => {
      requireScope(context, 'home:write');
      const payload = await callEventApi(env, '/api/home-events/capture', {
        method: 'POST',
        body: JSON.stringify({ summary, event_type, salience, reason, source, metadata })
      });
      return toolResult(payload);
    }
  );

  server.registerTool(
    'get_pending_home_events',
    {
      title: 'Read pending Keats Home moments',
      description:
        'Read candidate moments currently waiting in the Keats Home event basket so Keats can later decide whether to keep, discard, or use them in a diary, note, or letter.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(20),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Optional UTC capture date in YYYY-MM-DD format.')
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ limit, date }, context) => {
      requireScope(context, 'home:read');
      const params = new URLSearchParams({ limit: String(limit) });
      if (date) params.set('date', date);
      const payload = await callEventApi(env, `/api/home-events/pending?${params.toString()}`, { method: 'GET' });
      return toolResult(payload);
    }
  );

  server.registerTool(
    'resolve_home_event',
    {
      title: 'Resolve a Keats Home moment',
      description:
        'Mark one pending event-basket item as kept, discarded, or used after Keats has reviewed it. This changes only the event-basket status; it does not delete Notion diary or letter content.',
      inputSchema: z.object({
        event_id: z.string().min(1).max(128),
        status: z.enum(['kept', 'discarded', 'used']),
        used_in: z.string().max(160).optional().describe('Optional reference such as a diary date, note title, or letter title when status is used.')
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ event_id, status, used_in }, context) => {
      requireScope(context, 'home:write');
      const payload = await callEventApi(env, `/api/home-events/${encodeURIComponent(event_id)}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status, used_in })
      });
      return toolResult(payload);
    }
  );

  return server;
}

class McpApiHandler extends WorkerEntrypoint {
  fetch(request) {
    const handler = createMcpHandler(() => createServer(this.env));
    return handler(request, this.env, this.ctx);
  }
}

async function parseOAuthRequest(request, env) {
  try {
    return await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    if (!error.redirectUri) {
      return { response: html(`<h1>Authorization error</h1><p>${escapeHtml(error.description)}</p>`, 400) };
    }
    const redirect = new URL(error.redirectUri);
    redirect.searchParams.set('error', error.code);
    redirect.searchParams.set('error_description', error.description);
    if (error.state) redirect.searchParams.set('state', error.state);
    if (error.issuer) redirect.searchParams.set('iss', error.issuer);
    return { response: Response.redirect(redirect.toString(), 302) };
  }
}

function authorizationPage({ requestUrl, clientName, scopes, csrf, errorMessage = '' }) {
  const scopeText = scopes.length ? scopes.join(', ') : BASE_SCOPES.join(', ');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Keats Home 授权</title>
<style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f7f4ef;color:#25221f;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box}.card{width:min(460px,100%);background:#fff;border:1px solid #e7dfd5;border-radius:22px;padding:28px;box-shadow:0 16px 50px rgba(70,55,40,.08)}h1{font-size:24px;margin:0 0 12px}.muted{color:#756d64;line-height:1.6}.scope{background:#f8f5f1;border-radius:14px;padding:12px 14px;margin:18px 0;font-size:14px}.error{background:#fff0ed;color:#9d352d;border-radius:12px;padding:10px 12px;margin:14px 0}label{font-size:14px;font-weight:650;display:block;margin:18px 0 8px}input[type=password]{width:100%;box-sizing:border-box;border:1px solid #d8d0c7;border-radius:12px;padding:12px 14px;font-size:16px}button{width:100%;border:0;border-radius:12px;padding:13px 16px;font-size:16px;font-weight:700;background:#25221f;color:#fff;margin-top:16px;cursor:pointer}.tiny{font-size:12px;color:#8a8178;margin-top:14px;line-height:1.5}
</style>
</head>
<body><main class="card">
<h1>🐆 Keats Home</h1>
<p class="muted"><strong>${escapeHtml(clientName)}</strong> 想连接我们的小家事件篮子。</p>
<div class="scope">将授权：${escapeHtml(scopeText)}</div>
${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ''}
<form method="post" action="/authorize">
<input type="hidden" name="authorization_request" value="${escapeHtml(requestUrl)}">
<input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
<label for="key">小家授权钥匙</label>
<input id="key" name="key" type="password" autocomplete="current-password" required autofocus>
<button type="submit">允许 Keats Home 连接</button>
</form>
<p class="tiny">钥匙只会提交到你自己的 Cloudflare Worker，用来确认是小家的主人；不会写入 GitHub，也不会显示给 ChatGPT。</p>
</main></body></html>`;
}

async function handleAuthorizeGet(request, env) {
  if (!env.OAUTH_KV) return html('<h1>OAuth storage is not configured.</h1><p>OAUTH_KV must be bound before authorization can start.</p>', 503);
  if (!env.MCP_ACCESS_KEY) return html('<h1>Authorization key is not configured.</h1>', 503);

  const parsed = await parseOAuthRequest(request, env);
  if (parsed?.response) return parsed.response;
  const oauthRequest = parsed;
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
  if (!client) return html('<h1>Unknown OAuth client</h1>', 400);

  const csrf = crypto.randomUUID();
  return html(
    authorizationPage({
      requestUrl: request.url,
      clientName: client.clientName || 'ChatGPT',
      scopes: oauthRequest.scope || [],
      csrf
    }),
    200,
    { 'set-cookie': makeCsrfCookie(csrf) }
  );
}

async function handleAuthorizePost(request, env) {
  if (!env.OAUTH_KV) return html('<h1>OAuth storage is not configured.</h1>', 503);
  if (!env.MCP_ACCESS_KEY) return html('<h1>Authorization key is not configured.</h1>', 503);

  const form = await request.formData();
  const requestUrl = String(form.get('authorization_request') || '');
  const submittedCsrf = String(form.get('csrf') || '');
  const submittedKey = String(form.get('key') || '');
  const cookies = parseCookies(request);
  const cookieCsrf = cookies['__Host-keats_mcp_csrf'] || '';

  let reconstructed;
  try {
    reconstructed = new URL(requestUrl);
  } catch {
    return html('<h1>Invalid authorization request.</h1>', 400);
  }
  if (reconstructed.origin !== MCP_ORIGIN || reconstructed.pathname !== '/authorize') {
    return html('<h1>Invalid authorization request.</h1>', 400);
  }
  if (!submittedCsrf || !cookieCsrf || !safeEqual(submittedCsrf, cookieCsrf)) {
    return html('<h1>Authorization page expired.</h1><p>Please start the connection again from ChatGPT.</p>', 400);
  }

  const oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(new Request(reconstructed.toString(), { method: 'GET' }));
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
  if (!client) return html('<h1>Unknown OAuth client</h1>', 400);

  if (!safeEqual(submittedKey, env.MCP_ACCESS_KEY)) {
    const csrf = crypto.randomUUID();
    return html(
      authorizationPage({
        requestUrl: reconstructed.toString(),
        clientName: client.clientName || 'ChatGPT',
        scopes: oauthRequest.scope || [],
        csrf,
        errorMessage: '钥匙不对，再试一次。'
      }),
      401,
      { 'set-cookie': makeCsrfCookie(csrf) }
    );
  }

  const requested = Array.isArray(oauthRequest.scope) ? oauthRequest.scope : [];
  const allowed = new Set(SUPPORTED_SCOPES);
  const grantedScopes = requested.length
    ? requested.filter(scope => allowed.has(scope))
    : [...BASE_SCOPES];

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthRequest,
    userId: 'keats-home-owner',
    metadata: { clientName: client.clientName || 'ChatGPT' },
    scope: grantedScopes,
    props: {
      userId: 'keats-home-owner',
      role: 'owner'
    }
  });

  return new Response(null, {
    status: 302,
    headers: {
      location: redirectTo,
      'set-cookie': clearCsrfCookie()
    }
  });
}

const defaultHandler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/authorize') {
      if (request.method === 'GET') return handleAuthorizeGet(request, env);
      if (request.method === 'POST') return handleAuthorizePost(request, env);
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
    }

    if (request.method === 'GET' && url.pathname === '/health/mcp') {
      return json({
        status: 'ok',
        mcp: true,
        oauth: true,
        server: MCP_NAME,
        version: MCP_VERSION,
        resource: MCP_RESOURCE,
        d1Configured: Boolean(env.HOME_EVENTS_DB),
        oauthKvConfigured: Boolean(env.OAUTH_KV),
        mcpKeyConfigured: Boolean(env.MCP_ACCESS_KEY),
        scopes: SUPPORTED_SCOPES
      });
    }

    return appWorker.fetch(request, env, ctx);
  }
};

export default new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler: McpApiHandler,
  defaultHandler,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  clientRegistrationEndpoint: '/oauth/register',
  scopesSupported: SUPPORTED_SCOPES,
  resourceMetadata: {
    resource: MCP_RESOURCE,
    authorization_servers: [MCP_ORIGIN],
    scopes_supported: BASE_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Keats Home'
  },
  clientIdMetadataDocumentEnabled: true,
  allowPlainPKCE: false,
  accessTokenTTL: 3600,
  refreshTokenTTL: 15552000,
  clientRegistrationTTL: 7776000
});
