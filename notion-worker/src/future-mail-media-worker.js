import futureMailWorker from './future-mail-worker.js';

const NOTION_VERSION = '2026-03-11';
const NOTION_API = 'https://api.notion.com/v1';
const FUTURE_MAIL_SOURCE_ID = '1b04eef4-4d1a-4b29-94e2-c879a5a16a44';
const DEFAULT_ORIGIN = 'https://gulugulu-lucky.github.io';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  'image/gif', 'image/heic', 'image/jpeg', 'image/png', 'image/svg+xml',
  'image/tiff', 'image/webp', 'image/vnd.microsoft.icon'
]);

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

async function notionRequest(path, env, init = {}, isForm = false) {
  if (!env.NOTION_TOKEN) throw Object.assign(new Error('NOTION_TOKEN is not configured'), { status: 503 });
  const headers = {
    Authorization: `Bearer ${env.NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    ...(init.headers || {})
  };
  if (!isForm) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${NOTION_API}${path}`, { ...init, headers });
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
  if (value.type === 'select') return value.select?.name || null;
  if (value.type === 'date') return value.date?.start || null;
  if (value.type === 'title') return plainRich(value.title || []);
  return null;
}

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function getFutureMailPage(mailId, env, requireUserAuthored = false) {
  if (!/^[0-9a-fA-F-]{32,36}$/.test(String(mailId || ''))) throw Object.assign(new Error('这封信的编号不对。'), { status: 400 });
  const page = await notionRequest(`/pages/${mailId}`, env, { method: 'GET' });
  if (page.parent?.type !== 'data_source_id' || page.parent?.data_source_id !== FUTURE_MAIL_SOURCE_ID) {
    throw Object.assign(new Error('这封信不在未来邮局里。'), { status: 404 });
  }
  if (requireUserAuthored && prop(page, '寄件人') !== '小猫') {
    throw Object.assign(new Error('这不是小猫刚寄出的信，不能从网页追加照片。'), { status: 403 });
  }
  return page;
}

async function uploadPhoto(request, env) {
  if (!(await authorized(request, env))) throw Object.assign(new Error('小家钥匙不对。'), { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  const mailId = String(form.get('mailId') || '').trim();
  const caption = String(form.get('caption') || '').trim().slice(0, 240);
  if (!(file instanceof File)) throw Object.assign(new Error('还没有选照片。'), { status: 400 });
  if (file.size <= 0) throw Object.assign(new Error('这张照片好像是空的。'), { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) throw Object.assign(new Error('单张照片不能超过 5 MB。'), { status: 413 });
  if (file.type && !IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw Object.assign(new Error('这个图片格式暂时不收。可以用 HEIC、JPG、PNG、GIF、WebP 或 TIFF。'), { status: 415 });
  }
  await getFutureMailPage(mailId, env, true);

  const filename = file.name || `future-mail-${Date.now()}.jpg`;
  const createBody = { mode: 'single_part', filename };
  if (file.type) createBody.content_type = file.type;
  const upload = await notionRequest('/file_uploads', env, { method: 'POST', body: JSON.stringify(createBody) });
  const sendForm = new FormData();
  sendForm.append('file', file, filename);
  const sent = await notionRequest(`/file_uploads/${upload.id}/send`, env, { method: 'POST', body: sendForm }, true);
  if (sent.status !== 'uploaded') throw Object.assign(new Error('照片已经递给 Notion，但还没确认收好。'), { status: 502 });

  await notionRequest(`/blocks/${mailId}/children`, env, {
    method: 'PATCH',
    body: JSON.stringify({ children: [{
      object: 'block',
      type: 'image',
      image: {
        type: 'file_upload',
        file_upload: { id: upload.id },
        caption: caption ? [{ type: 'text', text: { content: caption } }] : []
      }
    }] })
  });
  return { status: 'ok', mailId, filename, size: file.size };
}

async function listMedia(request, env, url) {
  if (!(await authorized(request, env))) throw Object.assign(new Error('小家钥匙不对。'), { status: 401 });
  const mailId = String(url.searchParams.get('mailId') || '').trim();
  const page = await getFutureMailPage(mailId, env, false);
  const openDate = prop(page, '开封日期') || shanghaiDate();
  if (openDate > shanghaiDate()) return { opened: false, images: [] };

  const images = [];
  let cursor = null;
  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (cursor) params.set('start_cursor', cursor);
    const data = await notionRequest(`/blocks/${mailId}/children?${params}`, env, { method: 'GET' });
    for (const block of data.results || []) {
      if (block.type !== 'image') continue;
      const image = block.image || {};
      const src = image.type === 'file' ? image.file?.url : image.type === 'external' ? image.external?.url : null;
      if (!src) continue;
      images.push({
        url: src,
        caption: plainRich(image.caption || []),
        expiryTime: image.type === 'file' ? (image.file?.expiry_time || null) : null
      });
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return { opened: true, images };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health/future-mail-media' && request.method === 'GET') {
      return json({ status: 'ok', photoUploadConfigured: true, maxFileMiB: 5, maxPhotosPerLetter: 4 }, 200, request, env);
    }

    if (url.pathname === '/api/future-mail/photo') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, request, env);
      try { return json(await uploadPhoto(request, env), 200, request, env); }
      catch (error) { return json({ error: error.message || '照片没有塞进信封。' }, Number(error.status) || 500, request, env); }
    }

    if (url.pathname === '/api/future-mail/media') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, request, env);
      try { return json(await listMedia(request, env, url), 200, request, env); }
      catch (error) { return json({ error: error.message || '照片还没取到。' }, Number(error.status) || 500, request, env); }
    }

    return futureMailWorker.fetch(request, env, ctx);
  }
};
