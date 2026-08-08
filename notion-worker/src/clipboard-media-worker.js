import appWorker from './radio-source-worker.js';

const NOTION_VERSION = '2026-03-11';
const NOTION_API = 'https://api.notion.com/v1';
const DEFAULT_ORIGIN = 'https://gulugulu-lucky.github.io';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PAWPRINT_PAGE_ID = '3b5f5826-81e2-8112-aa55-e63efec1f9b6';
const NOTES_SOURCE_ID = 'd55dca49-b8ad-46d1-b0d5-f614ed0d7016';
const ALLOWED_SOURCES = {
  diary: '4147771d-6a7d-4221-ab49-17cd62ca96df',
  letters: '71e426c7-ed0c-4cf3-8326-1ccaa753b701',
  memories: 'a39f9a63-dcef-4930-87d1-5de8af03c608',
  notes: NOTES_SOURCE_ID
};
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

async function verifiedTarget(kind, pageId, env) {
  if (kind === 'pawprints') return PAWPRINT_PAGE_ID;
  const sourceId = ALLOWED_SOURCES[kind];
  if (!sourceId) throw Object.assign(new Error('这个房间暂时不能贴图。'), { status: 400 });
  if (!/^[0-9a-fA-F-]{32,36}$/.test(String(pageId || ''))) throw Object.assign(new Error('这页的编号不对。'), { status: 400 });
  const page = await notionRequest(`/pages/${pageId}`, env, { method: 'GET' });
  if (page.parent?.type !== 'data_source_id' || page.parent?.data_source_id !== sourceId) {
    throw Object.assign(new Error('这张图不能贴到这个位置。'), { status: 403 });
  }
  return page.id;
}

async function uploadImage(request, env) {
  if (!(await authorized(request, env))) throw Object.assign(new Error('小家钥匙不对。'), { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  const kind = String(form.get('kind') || '').trim();
  const pageId = String(form.get('pageId') || '').trim();
  const caption = String(form.get('caption') || '').trim().slice(0, 240);
  if (!(file instanceof File)) throw Object.assign(new Error('剪贴板里没有拿到图片。'), { status: 400 });
  if (file.size <= 0) throw Object.assign(new Error('这张图是空的。'), { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) throw Object.assign(new Error('单张图片不能超过 5 MB。'), { status: 413 });
  if (file.type && !IMAGE_TYPES.has(file.type.toLowerCase())) throw Object.assign(new Error('这个图片格式暂时不收。'), { status: 415 });

  const targetId = await verifiedTarget(kind, pageId, env);
  const filename = file.name || `pasted-${Date.now()}.png`;
  const createBody = { mode: 'single_part', filename };
  if (file.type) createBody.content_type = file.type;
  const upload = await notionRequest('/file_uploads', env, { method: 'POST', body: JSON.stringify(createBody) });
  const sendForm = new FormData();
  sendForm.append('file', file, filename);
  const sent = await notionRequest(`/file_uploads/${upload.id}/send`, env, { method: 'POST', body: sendForm }, true);
  if (sent.status !== 'uploaded') throw Object.assign(new Error('图片递给 Notion 了，但还没确认收好。'), { status: 502 });

  await notionRequest(`/blocks/${targetId}/children`, env, {
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
  return { status: 'ok', pageId: targetId, filename, size: file.size };
}

async function noteImages(noteId, env) {
  const data = await notionRequest(`/blocks/${noteId}/children?page_size=100`, env, { method: 'GET' });
  return (data.results || []).flatMap(block => {
    if (block.type !== 'image') return [];
    const image = block.image || {};
    const src = image.type === 'file' ? image.file?.url : image.type === 'external' ? image.external?.url : null;
    return src ? [{ url: src }] : [];
  });
}

async function murmurs(request, env, url) {
  if (!(await authorized(request, env))) throw Object.assign(new Error('小家钥匙不对。'), { status: 401 });
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 24, 40));
  const base = await appWorker.fetch(new Request(`${url.origin}/api/notes?limit=${limit}`, {
    method: 'GET', headers: request.headers
  }), env);
  const payload = await base.json();
  if (!base.ok) throw Object.assign(new Error(payload.error || '碎碎念抽屉没翻开。'), { status: base.status });
  const items = await Promise.all((payload.items || []).map(async item => ({
    ...item,
    images: await noteImages(item.id, env).catch(() => [])
  })));
  return { items };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health/entry-media') {
      return json({ status: 'ok', clipboardImages: true, maxFileMiB: 5 }, 200, request, env);
    }

    if (url.pathname === '/api/entry-media') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, request, env);
      try { return json(await uploadImage(request, env), 200, request, env); }
      catch (error) { return json({ error: error.message || '图片没贴稳。' }, Number(error.status) || 500, request, env); }
    }

    if (url.pathname === '/api/murmurs') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, request, env);
      try { return json(await murmurs(request, env, url), 200, request, env); }
      catch (error) { return json({ error: error.message || '碎碎念还没翻出来。' }, Number(error.status) || 500, request, env); }
    }

    return appWorker.fetch(request, env, ctx);
  }
};
