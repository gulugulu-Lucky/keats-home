import notesWorker from './notes-worker.js';

const NOTION_VERSION = '2026-03-11';
const NOTION_API = 'https://api.notion.com/v1';
const FUTURE_MAIL_SOURCE_ID = '1b04eef4-4d1a-4b29-94e2-c879a5a16a44';
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
  return new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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

async function notion(path, env, init = {}) {
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
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
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
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dateOkay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function richText(value = '') {
  return [{ type: 'text', text: { content: String(value).slice(0, 2000) } }];
}

function normalize(page) {
  const today = shanghaiDate();
  const openDate = prop(page, '开封日期') || today;
  const opened = openDate <= today;
  const diff = Math.max(0, Math.ceil((Date.parse(`${openDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000));
  return {
    id: page.id,
    title: prop(page, '标题') || '一封未来来信',
    sentDate: prop(page, '寄出日期') || '',
    openDate,
    author: prop(page, '寄件人') || '',
    recipient: prop(page, '收件人') || '',
    method: prop(page, '投递方式') || '封存到某一天',
    receiptStatus: prop(page, '收件状态') || '等待收件',
    receivedDate: prop(page, '收件时间') || '',
    createdTime: page.created_time,
    opened,
    daysLeft: diff,
    content: opened ? (prop(page, '正文') || '') : ''
  };
}

async function listMail(env, limit = 50) {
  const pageSize = Math.max(1, Math.min(Number(limit) || 50, 100));
  const data = await notion(`/data_sources/${FUTURE_MAIL_SOURCE_ID}/query`, env, {
    method: 'POST',
    body: JSON.stringify({ page_size: pageSize, sorts: [{ timestamp: 'created_time', direction: 'descending' }] })
  });
  return { items: (data.results || []).map(normalize), hasMore: data.has_more, nextCursor: data.next_cursor };
}

async function createMail(request, env) {
  const payload = await request.json().catch(() => ({}));
  const today = shanghaiDate();
  const method = ['现在寄出', '定时投递', '封存到某一天'].includes(payload.method) ? payload.method : '封存到某一天';
  const openDate = method === '现在寄出' ? today : String(payload.openDate || '');
  const title = String(payload.title || '').trim() || '写给未来的一封信';
  const content = String(payload.content || '').trim();
  const author = '小猫';
  const recipient = payload.recipient === 'Keats' ? 'Keats' : '小猫';

  if (!content) throw Object.assign(new Error('信纸还是空的。'), { status: 400 });
  if (content.length > 2000) throw Object.assign(new Error('未来邮局第一版每封信最多 2000 字。'), { status: 400 });
  if (method !== '现在寄出' && (!dateOkay(openDate) || openDate < today)) {
    throw Object.assign(new Error('开封日期要选今天或以后。'), { status: 400 });
  }

  const created = await notion('/pages', env, {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'data_source_id', data_source_id: FUTURE_MAIL_SOURCE_ID },
      properties: {
        '标题': { type: 'title', title: richText(title) },
        '寄出日期': { type: 'date', date: { start: today } },
        '开封日期': { type: 'date', date: { start: openDate } },
        '寄件人': { type: 'select', select: { name: author } },
        '收件人': { type: 'select', select: { name: recipient } },
        '正文': { type: 'rich_text', rich_text: richText(content) },
        '投递方式': { type: 'select', select: { name: method } },
        '收件状态': { type: 'select', select: { name: '等待收件' } }
      },
      children: [{
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: richText(content) }
      }]
    })
  });
  return { status: 'ok', item: normalize(created) };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health/future-mail') {
      try {
        await notion(`/data_sources/${FUTURE_MAIL_SOURCE_ID}/query`, env, { method: 'POST', body: JSON.stringify({ page_size: 1 }) });
        return json({ status: 'ok', futureMailReachable: true }, 200, request, env);
      } catch (error) {
        return json({ status: 'error', futureMailReachable: false, message: error.message }, Number(error.status) || 500, request, env);
      }
    }

    if (url.pathname === '/api/future-mail') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      if (!(await authorized(request, env))) return json({ error: '小家钥匙不对。' }, 401, request, env);
      try {
        if (request.method === 'GET') return json(await listMail(env, url.searchParams.get('limit')), 200, request, env);
        if (request.method === 'POST') return json(await createMail(request, env), 200, request, env);
        return json({ error: 'Method not allowed' }, 405, request, env);
      } catch (error) {
        const status = Number(error.status) || 500;
        return json({ error: error.message || '这封信没有投递成功。', detail: status >= 500 ? undefined : error.detail }, status, request, env);
      }
    }

    return notesWorker.fetch(request, env, ctx);
  }
};
