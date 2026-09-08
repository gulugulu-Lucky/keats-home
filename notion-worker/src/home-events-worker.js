import appWorker from './clipboard-media-worker.js';

const DEFAULT_ORIGIN = 'https://gulugulu-lucky.github.io';
const VALID_STATUSES = new Set(['kept', 'discarded', 'used']);

function frontendOrigin(env) {
  return (env.FRONTEND_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = frontendOrigin(env);
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (origin && origin.replace(/\/$/, '') === allowed) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(request, env) }
  });
}

function clamp01(value, fallback = 0.5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function requireDb(env) {
  if (!env.HOME_EVENTS_DB) {
    throw Object.assign(new Error('HOME_EVENTS_DB is not configured'), { status: 503 });
  }
  return env.HOME_EVENTS_DB;
}

function authorized(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  const bearer = header.slice(7);
  return Boolean(
    (env.MCP_ACCESS_KEY && bearer === env.MCP_ACCESS_KEY) ||
    (env.HOME_ACCESS_KEY && bearer === env.HOME_ACCESS_KEY)
  );
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function captureEvent(request, env) {
  if (!authorized(request, env)) throw Object.assign(new Error('事件篮子钥匙不对。'), { status: 401 });
  const db = requireDb(env);
  const body = await request.json().catch(() => ({}));
  const summary = cleanText(body.summary, 500);
  if (!summary) throw Object.assign(new Error('summary 不能为空。'), { status: 400 });

  const eventType = cleanText(body.eventType || body.event_type || 'daily', 64) || 'daily';
  const salience = clamp01(body.salience, 0.5);
  const reason = cleanText(body.reason, 500) || null;
  const source = cleanText(body.source || 'chat', 64) || 'chat';
  const now = Date.now();
  const capturedDate = new Date(now).toISOString().slice(0, 10);
  const id = crypto.randomUUID();
  const dedupeKey = await sha256(`${capturedDate}|${eventType}|${summary.toLowerCase()}`);
  let metadataJson = null;

  if (body.metadata && typeof body.metadata === 'object') {
    const encoded = JSON.stringify(body.metadata);
    metadataJson = encoded.length <= 4000 ? encoded : JSON.stringify({ truncated: true });
  }

  const result = await db.prepare(`
    INSERT INTO home_events (
      id, created_at, captured_date, summary, event_type, salience,
      reason, status, source, metadata_json, dedupe_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    ON CONFLICT(dedupe_key) DO NOTHING
  `).bind(
    id, now, capturedDate, summary, eventType, salience,
    reason, source, metadataJson, dedupeKey
  ).run();

  if ((result.meta?.changes || 0) === 0) {
    const existing = await db.prepare(`
      SELECT id, created_at, captured_date, summary, event_type, salience, reason, status, source, used_in, resolved_at
      FROM home_events WHERE dedupe_key = ? LIMIT 1
    `).bind(dedupeKey).first();
    return { status: 'duplicate', item: existing };
  }

  return {
    status: 'captured',
    item: {
      id, created_at: now, captured_date: capturedDate, summary,
      event_type: eventType, salience, reason, status: 'pending', source
    }
  };
}

async function pendingEvents(request, env, url) {
  if (!authorized(request, env)) throw Object.assign(new Error('事件篮子钥匙不对。'), { status: 401 });
  const db = requireDb(env);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 20, 100));
  const date = cleanText(url.searchParams.get('date'), 10);

  let query = `
    SELECT id, created_at, captured_date, summary, event_type, salience, reason, status, source, used_in, resolved_at, metadata_json
    FROM home_events
    WHERE status = 'pending'
  `;
  const bindings = [];
  if (date) {
    query += ' AND captured_date = ?';
    bindings.push(date);
  }
  query += ' ORDER BY created_at ASC LIMIT ?';
  bindings.push(limit);

  const data = await db.prepare(query).bind(...bindings).all();
  const items = (data.results || []).map(item => ({
    ...item,
    metadata: item.metadata_json ? safeParse(item.metadata_json) : null,
    metadata_json: undefined
  }));
  return { items };
}

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

async function resolveEvent(request, env, id) {
  if (!authorized(request, env)) throw Object.assign(new Error('事件篮子钥匙不对。'), { status: 401 });
  const db = requireDb(env);
  const body = await request.json().catch(() => ({}));
  const status = cleanText(body.status, 32);
  if (!VALID_STATUSES.has(status)) {
    throw Object.assign(new Error('status 只能是 kept、discarded 或 used。'), { status: 400 });
  }
  const usedIn = cleanText(body.usedIn || body.used_in, 160) || null;
  const resolvedAt = Date.now();
  const result = await db.prepare(`
    UPDATE home_events
    SET status = ?, used_in = ?, resolved_at = ?
    WHERE id = ? AND status = 'pending'
  `).bind(status, usedIn, resolvedAt, id).run();

  if ((result.meta?.changes || 0) === 0) {
    const existing = await db.prepare(`
      SELECT id, status, used_in, resolved_at FROM home_events WHERE id = ? LIMIT 1
    `).bind(id).first();
    if (!existing) throw Object.assign(new Error('没有找到这件事。'), { status: 404 });
    return { status: 'already_resolved', item: existing };
  }

  return { status: 'resolved', item: { id, status, used_in: usedIn, resolved_at: resolvedAt } };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health/home-events') {
      return json({
        status: 'ok',
        eventBasket: true,
        d1Configured: Boolean(env.HOME_EVENTS_DB),
        mcpKeyConfigured: Boolean(env.MCP_ACCESS_KEY)
      }, 200, request, env);
    }

    if (url.pathname.startsWith('/api/home-events')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      }

      try {
        if (request.method === 'POST' && url.pathname === '/api/home-events/capture') {
          return json(await captureEvent(request, env), 200, request, env);
        }
        if (request.method === 'GET' && url.pathname === '/api/home-events/pending') {
          return json(await pendingEvents(request, env, url), 200, request, env);
        }
        const match = url.pathname.match(/^\/api\/home-events\/([^/]+)\/resolve$/);
        if (request.method === 'POST' && match) {
          return json(await resolveEvent(request, env, decodeURIComponent(match[1])), 200, request, env);
        }
        return json({ error: 'Method or route not allowed' }, 405, request, env);
      } catch (error) {
        return json({ error: error.message || '事件篮子没有接稳。' }, Number(error.status) || 500, request, env);
      }
    }

    return appWorker.fetch(request, env, ctx);
  }
};
