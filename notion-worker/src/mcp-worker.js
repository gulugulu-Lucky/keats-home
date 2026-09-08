import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import appWorker from './home-events-worker.js';

const MCP_NAME = 'keats-home';
const MCP_VERSION = '1.0.0';
const ALLOWED_ORIGIN_SUFFIXES = ['.chatgpt.com', '.openai.com'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function originAllowed(request, env) {
  const raw = request.headers.get('Origin');
  if (!raw) return true;
  try {
    const origin = new URL(raw);
    const frontend = env.FRONTEND_ORIGIN ? new URL(env.FRONTEND_ORIGIN).origin : null;
    if (frontend && origin.origin === frontend) return true;
    if (origin.protocol !== 'https:') return false;
    return ALLOWED_ORIGIN_SUFFIXES.some(suffix => origin.hostname === suffix.slice(1) || origin.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

function mcpAuthorized(request, env) {
  if (!env.MCP_ACCESS_KEY) return false;
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') && header.slice(7) === env.MCP_ACCESS_KEY;
}

function internalRequest(env, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${env.MCP_ACCESS_KEY}`);
  if (init.body != null) headers.set('Content-Type', 'application/json');
  return new Request(`https://keats-home.internal${path}`, { ...init, headers });
}

async function callEventApi(env, path, init = {}) {
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
    async ({ summary, event_type, salience, reason, source, metadata }) => {
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
    async ({ limit, date }) => {
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
    async ({ event_id, status, used_in }) => {
      const payload = await callEventApi(env, `/api/home-events/${encodeURIComponent(event_id)}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status, used_in })
      });
      return toolResult(payload);
    }
  );

  return server;
}

async function serveMcp(request, env) {
  if (!originAllowed(request, env)) {
    return json({ error: 'Origin not allowed' }, 403);
  }
  if (!mcpAuthorized(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'www-authenticate': 'Bearer realm="keats-home-mcp"'
      }
    });
  }

  const handler = createMcpHandler(() => createServer(env));
  return handler.fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health/mcp') {
      return json({
        status: 'ok',
        mcp: true,
        server: MCP_NAME,
        version: MCP_VERSION,
        d1Configured: Boolean(env.HOME_EVENTS_DB),
        mcpKeyConfigured: Boolean(env.MCP_ACCESS_KEY)
      });
    }

    if (url.pathname === '/mcp') {
      return serveMcp(request, env);
    }

    return appWorker.fetch(request, env, ctx);
  }
};
