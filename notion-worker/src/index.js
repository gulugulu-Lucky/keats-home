const NOTION_VERSION = '2026-03-11';
const NOTION_API = 'https://api.notion.com/v1';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const SOURCES = {
  diary: '4147771d-6a7d-4221-ab49-17cd62ca96df',
  letters: '71e426c7-ed0c-4cf3-8326-1ccaa753b701',
  memories: 'a39f9a63-dcef-4930-87d1-5de8af03c608',
  timeline: '339e63b7-a3e6-4348-b1e4-0d443338688c',
  quotes: '79f172bc-15c0-4b00-94c2-3782a849e52e',
  songs: '46007b16-1ed3-4083-a265-22aacae1bb5c'
};

const PAWPRINT_PAGE_ID = '3b5f5826-81e2-8112-aa55-e63efec1f9b6';
const DEFAULT_ORIGIN = 'https://gulugulu-lucky.github.io';

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.FRONTEND_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (origin && origin.replace(/\/$/, '') === allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function stringToBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(value));
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

async function issueSession(env) {
  if (!env.HOME_ACCESS_KEY) throw Object.assign(new Error('HOME_ACCESS_KEY is not configured'), { status: 503 });
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    aud: 'keats-home',
    nonce: crypto.randomUUID()
  };
  const encoded = stringToBase64Url(JSON.stringify(payload));
  const signature = await sign(encoded, env.HOME_ACCESS_KEY);
  return { token: `${encoded}.${signature}`, expiresAt: payload.exp * 1000 };
}

async function verifySession(token, env) {
  if (!token || !env.HOME_ACCESS_KEY) return false;
  const [encoded, suppliedSignature, extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra) return false;
  const expectedSignature = await sign(encoded, env.HOME_ACCESS_KEY);
  if (suppliedSignature !== expectedSignature) return false;
  try {
    const payload = JSON.parse(base64UrlToString(encoded));
    const now = Math.floor(Date.now() / 1000);
    return payload.aud === 'keats-home' && Number(payload.exp) > now;
  } catch {
    return false;
  }
}

async function authorized(request, env) {
  const expected = env.HOME_ACCESS_KEY;
  if (!expected) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  const bearer = header.slice(7);
  if (bearer === expected) return true;
  return verifySession(bearer, env);
}

async function notion(path, env, init = {}) {
  if (!env.NOTION_TOKEN) throw new Error('NOTION_TOKEN is not configured');
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
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) {
    const error = new Error(data?.message || `Notion request failed: ${response.status}`);
    error.status = response.status;
    error.detail = data;
    throw error;
  }
  return data;
}

function richText(value = '') {
  if (!value) return [];
  return [{ type: 'text', text: { content: String(value).slice(0, 2000) } }];
}

function titleProp(value = '') {
  return { type: 'title', title: richText(value || '未命名') };
}

function richProp(value = '') {
  return { type: 'rich_text', rich_text: richText(value) };
}

function selectProp(value) {
  return value ? { type: 'select', select: { name: value } } : { type: 'select', select: null };
}

function multiProp(values = []) {
  return { type: 'multi_select', multi_select: values.filter(Boolean).map(name => ({ name })) };
}

function dateProp(value) {
  return { type: 'date', date: value ? { start: value } : null };
}

function checkboxProp(value) {
  return { type: 'checkbox', checkbox: Boolean(value) };
}

function plainRich(items = []) {
  return items.map(item => item.plain_text ?? item.text?.content ?? '').join('');
}

function propertyValue(prop) {
  if (!prop) return null;
  switch (prop.type) {
    case 'title': return plainRich(prop.title);
    case 'rich_text': return plainRich(prop.rich_text);
    case 'select': return prop.select?.name || null;
    case 'multi_select': return (prop.multi_select || []).map(item => item.name);
    case 'date': return prop.date?.start || null;
    case 'checkbox': return Boolean(prop.checkbox);
    case 'number': return prop.number;
    case 'files': return (prop.files || []).map(file => ({
      name: file.name,
      url: file.file?.url || file.external?.url || null,
      expiry: file.file?.expiry_time || null
    }));
    default: return null;
  }
}

function pick(page, name) {
  return propertyValue(page.properties?.[name]);
}

function normalizePage(page, kind) {
  const base = { id: page.id, url: page.url, createdTime: page.created_time, editedTime: page.last_edited_time };
  if (kind === 'diary') return {
    ...base,
    title: pick(page, '标题'), date: pick(page, '日期'), author: pick(page, '作者'),
    summary: pick(page, '内容摘要'), moods: pick(page, '心情') || [], types: pick(page, '类型') || [],
    keatsState: pick(page, '今日Keats状态'), catState: pick(page, '今日主猫态'), catStates: pick(page, '今日猫态合集') || [],
    energy: pick(page, '今日能量条'), inMemory: pick(page, '放进记忆库')
  };
  if (kind === 'letters') return {
    ...base,
    title: pick(page, '标题'), date: pick(page, '日期'), author: pick(page, '作者'), recipient: pick(page, '收信人'),
    summary: pick(page, '一句话摘要'), category: pick(page, '分类'), status: pick(page, '状态')
  };
  if (kind === 'memories') return {
    ...base,
    title: pick(page, '标题'), date: pick(page, '来源日期'), text: pick(page, '小家规则'), module: pick(page, '所属模块'),
    status: pick(page, '状态'), ruleType: pick(page, '规则类型'), category: pick(page, '记忆大类'), type: pick(page, '记忆类型'), importance: pick(page, '重要程度')
  };
  if (kind === 'timeline') return {
    ...base,
    title: pick(page, '事件名'), date: pick(page, '日期'), note: pick(page, '一句话备注'), type: pick(page, '类型'), status: pick(page, '状态')
  };
  if (kind === 'quotes') return {
    ...base,
    title: pick(page, '片段名'), date: pick(page, '日期'), quote: pick(page, '原话'), tone: pick(page, '当时的语气'),
    feelings: pick(page, '感觉') || [], source: pick(page, '来源'), starter: pick(page, '谁先开口'), aside: pick(page, 'Keats旁白'), images: pick(page, '截图') || []
  };
  if (kind === 'songs') return {
    ...base,
    title: pick(page, '歌名'), artist: pick(page, '歌手'), recommender: pick(page, '推荐人'), moods: pick(page, '氛围') || [], reason: pick(page, '为什么推荐')
  };
  return base;
}

async function querySource(kind, env, limit = 50) {
  const sourceId = SOURCES[kind];
  if (!sourceId) throw Object.assign(new Error('Unknown source'), { status: 404 });
  const body = { page_size: Math.max(1, Math.min(Number(limit) || 50, 100)) };
  const dateProperty = { diary: '日期', letters: '日期', memories: '来源日期', timeline: '日期', quotes: '日期' }[kind];
  if (dateProperty) body.sorts = [{ property: dateProperty, direction: 'descending' }];
  const data = await notion(`/data_sources/${sourceId}/query`, env, { method: 'POST', body: JSON.stringify(body) });
  return { items: (data.results || []).map(page => normalizePage(page, kind)), hasMore: data.has_more, nextCursor: data.next_cursor };
}

async function listBlocks(blockId, env) {
  const blocks = [];
  let cursor = null;
  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (cursor) params.set('start_cursor', cursor);
    const data = await notion(`/blocks/${blockId}/children?${params}`, env, { method: 'GET' });
    blocks.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return blocks;
}

function blockText(block) {
  const value = block?.[block.type];
  if (!value) return '';
  return plainRich(value.rich_text || value.caption || []);
}

async function getPawprints(env) {
  const blocks = await listBlocks(PAWPRINT_PAGE_ID, env);
  const items = [];
  let current = null;
  for (const block of blocks) {
    const text = blockText(block).trim();
    if (block.type === 'heading_3' && text.startsWith('🐾')) {
      if (current) items.push(current);
      current = { id: block.id, title: text.replace(/^🐾\s*\d+\s*[｜|]\s*/, '').trim(), body: '' };
      continue;
    }
    if (current && ['paragraph', 'quote', 'bulleted_list_item'].includes(block.type) && text) {
      current.body += `${current.body ? '\n' : ''}${text}`;
    }
  }
  if (current) items.push(current);
  return { items };
}

function paragraphBlocks(content = '') {
  const parts = String(content).split(/\n{2,}|\n/).map(text => text.trim()).filter(Boolean).slice(0, 80);
  return (parts.length ? parts : ['']).map(text => ({
    object: 'block', type: 'paragraph', paragraph: { rich_text: richText(text) }
  }));
}

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function createDatabaseEntry(kind, payload, env) {
  const today = payload.date || shanghaiDate();
  const title = String(payload.title || '').trim() || '未命名';
  const content = String(payload.content || '').trim();
  const author = payload.author === 'Keats' ? 'Keats' : '小猫';
  let properties;
  let sourceId;

  if (kind === 'diary') {
    sourceId = SOURCES.diary;
    properties = {
      '标题': titleProp(title),
      '日期': dateProp(today),
      '作者': selectProp(author),
      '内容摘要': richProp(content.slice(0, 180)),
      '心情': multiProp(payload.moods || []),
      '类型': multiProp(payload.types?.length ? payload.types : ['日常小记']),
      '放进记忆库': checkboxProp(false)
    };
  } else if (kind === 'letters') {
    sourceId = SOURCES.letters;
    const recipient = payload.recipient || (author === '小猫' ? 'Keats' : '小猫');
    properties = {
      '标题': titleProp(title),
      '日期': dateProp(today),
      '作者': selectProp(author),
      '收信人': selectProp(recipient),
      '一句话摘要': richProp(content.slice(0, 160)),
      '分类': selectProp(payload.category || '小纸条'),
      '状态': selectProp(payload.status || '已完成')
    };
  } else if (kind === 'memories') {
    sourceId = SOURCES.memories;
    properties = {
      '标题': titleProp(title),
      '来源日期': dateProp(today),
      '小家规则': richProp(content.slice(0, 500)),
      '所属模块': selectProp(payload.module || '重要节点记忆'),
      '状态': selectProp(payload.status || '仍然有效'),
      '记忆大类': selectProp(payload.category || '重要节点记忆'),
      '记忆类型': selectProp(payload.type || '事件'),
      '重要程度': selectProp(payload.importance || '⭐⭐⭐')
    };
  } else {
    throw Object.assign(new Error('This entry kind cannot be created here'), { status: 400 });
  }

  const created = await notion('/pages', env, {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'data_source_id', data_source_id: sourceId },
      properties,
      children: paragraphBlocks(content)
    })
  });
  return { item: normalizePage(created, kind) };
}

async function createPawprint(payload, env) {
  const existing = await getPawprints(env);
  const number = String(existing.items.length + 1).padStart(2, '0');
  const title = String(payload.title || '').trim() || '今天的一枚小爪印';
  const content = String(payload.content || '').trim();
  await notion(`/blocks/${PAWPRINT_PAGE_ID}/children`, env, {
    method: 'PATCH',
    body: JSON.stringify({
      position: { type: 'end' },
      children: [
        { object: 'block', type: 'heading_3', heading_3: { rich_text: richText(`🐾 ${number}｜${title}`) } },
        ...paragraphBlocks(content)
      ]
    })
  });
  return { item: { number, title, body: content } };
}

async function route(request, env) {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/health') {
    return {
      status: 'ok',
      notionConfigured: Boolean(env.NOTION_TOKEN),
      accessConfigured: Boolean(env.HOME_ACCESS_KEY),
      version: NOTION_VERSION
    };
  }

  if (request.method === 'GET' && url.pathname === '/health/notion') {
    try {
      await notion(`/data_sources/${SOURCES.diary}/query`, env, {
        method: 'POST',
        body: JSON.stringify({ page_size: 1 })
      });
      return { status: 'ok', notionReachable: true, diaryVisible: true };
    } catch (error) {
      return {
        status: 'error',
        notionReachable: false,
        diaryVisible: false,
        code: Number(error.status) || 500,
        message: error.message || 'Notion connection failed'
      };
    }
  }

  if (request.method === 'POST' && url.pathname === '/auth/login') {
    if (!env.HOME_ACCESS_KEY) throw Object.assign(new Error('HOME_ACCESS_KEY is not configured'), { status: 503 });
    const payload = await request.json().catch(() => ({}));
    if (String(payload.key || '') !== String(env.HOME_ACCESS_KEY)) {
      throw Object.assign(new Error('小家钥匙不对。'), { status: 401 });
    }
    const session = await issueSession(env);
    return { status: 'ok', ...session };
  }

  if (!url.pathname.startsWith('/api/')) throw Object.assign(new Error('Not found'), { status: 404 });
  if (!(await authorized(request, env))) throw Object.assign(new Error('小家钥匙不对。'), { status: 401 });

  if (request.method === 'GET') {
    if (url.pathname === '/api/pawprints') return getPawprints(env);
    const match = url.pathname.match(/^\/api\/(diary|letters|memories|timeline|quotes|songs)$/);
    if (match) return querySource(match[1], env, url.searchParams.get('limit'));
  }

  if (request.method === 'POST' && url.pathname === '/api/entries') {
    const payload = await request.json();
    const kindMap = { '日记': 'diary', '信': 'letters', '记忆': 'memories', '爪印': 'pawprints' };
    const kind = kindMap[payload.kind] || payload.kind;
    if (kind === 'pawprints') return createPawprint(payload, env);
    return createDatabaseEntry(kind, payload, env);
  }

  throw Object.assign(new Error('Not found'), { status: 404 });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const data = await route(request, env);
      return json(data, 200, cors);
    } catch (error) {
      const status = Number(error.status) || 500;
      return json({ error: error.message || 'Unexpected error', detail: status >= 500 ? undefined : error.detail }, status, cors);
    }
  }
};