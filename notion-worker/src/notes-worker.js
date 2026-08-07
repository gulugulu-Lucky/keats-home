import albumWorker from './album-worker.js';

const NOTION_VERSION = '2026-03-11';
const NOTION_API = 'https://api.notion.com/v1';
const NOTES_SOURCE_ID = 'd55dca49-b8ad-46d1-b0d5-f614ed0d7016';
const DEFAULT_ORIGIN = 'https://gulugulu-lucky.github.io';

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

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToString(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function authorized(request, env) {
  if (!env.HOME_ACCESS_KEY) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  const bearer = header.slice(7);
  if (bearer === env.HOME_ACCESS_KEY) return true;
  const [encoded, suppliedSignature, extra] = bearer.split('.');
  if (!encoded || !suppliedSignature || extra) return false;
  const expected = await sign(encoded, env.HOME_ACCESS_KEY);
  if (suppliedSignature !== expected) return false;
  try {
    const payload = JSON.parse(base64UrlToString(encoded));
    return payload.aud === 'keats-home' && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function notionRequest(path, env, init = {}) {
  if (!env.NOTION_TOKEN) throw Object.assign(new Error('NOTION_TOKEN is not configured'), { status: 503 });
  const response = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { message: text }; }
  if (!response.ok) {
    const error = new Error(data?.message || `Notion request failed: ${response.status}`);
    error.status = response.status;
    error.detail = data;
    throw error;
  }
  return data;
}

function plainRich(items = []) {
  return items.map(item => item.plain_text ?? item.text?.content ?? '').join('');
}

function prop(page, name) {
  const value = page.properties?.[name];
  if (!value) return null;
  if (value.type === 'title') return plainRich(value.title || []);
  if (value.type === 'rich_text') return plainRich(value.rich_text || []);
  if (value.type === 'select') return value.select?.name || null;
  if (value.type === 'date') return value.date?.start || null;
  return null;
}

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function richText(value = '') {
  return [{ type: 'text', text: { content: String(value).slice(0, 360) } }];
}

function normalizeNote(page) {
  return {
    id: page.id,
    title: prop(page, '标题') || '',
    date: prop(page, '日期') || '',
    author: prop(page, '作者') || '',
    content: prop(page, '内容') || '',
    createdTime: page.created_time,
    editedTime: page.last_edited_time
  };
}

async function listNotes(env, limit = 30) {
  const pageSize = Math.max(1, Math.min(Number(limit) || 30, 100));
  const data = await notionRequest(`/data_sources/${NOTES_SOURCE_ID}/query`, env, {
    method: 'POST',
    body: JSON.stringify({
      page_size: pageSize,
      sorts: [{ property: '创建时间', direction: 'descending' }]
    })
  });
  return {
    items: (data.results || []).map(normalizeNote),
    hasMore: data.has_more,
    nextCursor: data.next_cursor
  };
}

async function createNote(request, env) {
  const payload = await request.json().catch(() => ({}));
  const content = String(payload.content || '').trim();
  const author = payload.author === 'Keats' ? 'Keats' : '小猫';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || '')) ? String(payload.date) : shanghaiDate();
  if (!content) throw Object.assign(new Error('这张纸还是空的。'), { status: 400 });
  if (content.length > 360) throw Object.assign(new Error('小纸条最多写 360 个字，留一点空白给纸角。'), { status: 400 });

  const shortDate = date.slice(5).replace('-', '.');
  const created = await notionRequest('/pages', env, {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'data_source_id', data_source_id: NOTES_SOURCE_ID },
      properties: {
        '标题': { type: 'title', title: richText(`${shortDate}｜${author}的小纸条`) },
        '日期': { type: 'date', date: { start: date } },
        '作者': { type: 'select', select: { name: author } },
        '内容': { type: 'rich_text', rich_text: richText(content) }
      }
    })
  });
  return { status: 'ok', item: normalizeNote(created) };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health/little-notes') {
      try {
        await notionRequest(`/data_sources/${NOTES_SOURCE_ID}/query`, env, {
          method: 'POST',
          body: JSON.stringify({ page_size: 1 })
        });
        return json({ status: 'ok', notesReachable: true, sourceConfigured: true }, 200, request, env);
      } catch (error) {
        return json({ status: 'error', notesReachable: false, sourceConfigured: true, message: error.message }, Number(error.status) || 500, request, env);
      }
    }

    if (url.pathname === '/api/notes') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      if (!(await authorized(request, env))) return json({ error: '小家钥匙不对。' }, 401, request, env);
      try {
        if (request.method === 'GET') {
          const data = await listNotes(env, url.searchParams.get('limit'));
          return json(data, 200, request, env);
        }
        if (request.method === 'POST') {
          const data = await createNote(request, env);
          return json(data, 200, request, env);
        }
        return json({ error: 'Method not allowed' }, 405, request, env);
      } catch (error) {
        const status = Number(error.status) || 500;
        return json({ error: error.message || '小纸条没有放好。', detail: status >= 500 ? undefined : error.detail }, status, request, env);
      }
    }

    return albumWorker.fetch(request, env, ctx);
  }
};
