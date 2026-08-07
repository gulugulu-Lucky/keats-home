import baseWorker from './index.js';

const NOTION_VERSION = '2026-03-11';
const NOTION_API = 'https://api.notion.com/v1';
const ALBUM_PAGE_ID = '37ff5826-81e2-8199-86a5-f6dbbfe19abb';
const DEFAULT_ORIGIN = 'https://gulugulu-lucky.github.io';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALBUM_SECTIONS = new Set([
  'Keats的照片',
  '小猫的照片',
  '形象图 / 捏人 / 画像',
  '专属区',
  '表情包收藏'
]);
const IMAGE_TYPES = new Set([
  'image/gif',
  'image/heic',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/tiff',
  'image/webp',
  'image/vnd.microsoft.icon'
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
  return items.map(item => item.plain_text ?? item.text?.content ?? '').join('').trim();
}

async function albumToggle(section, env) {
  let cursor = null;
  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (cursor) params.set('start_cursor', cursor);
    const data = await notionRequest(`/blocks/${ALBUM_PAGE_ID}/children?${params}`, env, { method: 'GET' });
    const found = (data.results || []).find(block => block.type === 'toggle' && plainRich(block.toggle?.rich_text || []) === section);
    if (found) return found;
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return null;
}

async function uploadAlbumImage(request, env) {
  if (!(await authorized(request, env))) {
    throw Object.assign(new Error('小家钥匙不对。'), { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const section = String(form.get('section') || '').trim();
  const caption = String(form.get('caption') || '').trim().slice(0, 240);

  if (!(file instanceof File)) throw Object.assign(new Error('还没有选照片。'), { status: 400 });
  if (!ALBUM_SECTIONS.has(section)) throw Object.assign(new Error('这个相册抽屉不存在。'), { status: 400 });
  if (file.size <= 0) throw Object.assign(new Error('这张照片好像是空的。'), { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) throw Object.assign(new Error('这张图超过 5 MB 啦，先选一张小一点的。'), { status: 413 });
  if (file.type && !IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw Object.assign(new Error('这个图片格式 Notion 暂时不收。可以用 HEIC、JPG、PNG、GIF、WebP 或 TIFF。'), { status: 415 });
  }

  const target = await albumToggle(section, env);
  if (!target) throw Object.assign(new Error(`Notion 里没找到「${section}」这个抽屉。`), { status: 404 });

  const filename = file.name || `keats-home-${Date.now()}.jpg`;
  const createBody = { mode: 'single_part', filename };
  if (file.type) createBody.content_type = file.type;
  const upload = await notionRequest('/file_uploads', env, {
    method: 'POST',
    body: JSON.stringify(createBody)
  });

  const sendForm = new FormData();
  sendForm.append('file', file, filename);
  const sent = await notionRequest(`/file_uploads/${upload.id}/send`, env, {
    method: 'POST',
    body: sendForm
  }, true);
  if (sent.status !== 'uploaded') {
    throw Object.assign(new Error('照片已经递给 Notion，但还没确认收好。再试一次。'), { status: 502 });
  }

  await notionRequest(`/blocks/${target.id}/children`, env, {
    method: 'PATCH',
    body: JSON.stringify({
      children: [{
        object: 'block',
        type: 'image',
        image: {
          type: 'file_upload',
          file_upload: { id: upload.id },
          caption: caption ? [{ type: 'text', text: { content: caption } }] : []
        }
      }]
    })
  });

  return { status: 'ok', section, filename, size: file.size };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health/album-upload' && request.method === 'GET') {
      return json({ status: 'ok', uploadConfigured: true, maxFileMiB: 5 }, 200, request, env);
    }

    if (url.pathname === '/api/album/upload') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, request, env);
      try {
        const data = await uploadAlbumImage(request, env);
        return json(data, 200, request, env);
      } catch (error) {
        const status = Number(error.status) || 500;
        return json({ error: error.message || '照片没有放进去。', detail: status >= 500 ? undefined : error.detail }, status, request, env);
      }
    }

    return baseWorker.fetch(request, env, ctx);
  }
};
