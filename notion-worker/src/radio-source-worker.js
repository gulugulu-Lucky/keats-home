import appWorker from './future-mail-media-worker.js';

const NOTION_VERSION = '2026-03-11';
const NOTION_API = 'https://api.notion.com/v1';
const SONGS_SOURCE_ID = '46007b16-1ed3-4083-a265-22aacae1bb5c';

async function notionSongs(env) {
  if (!env.NOTION_TOKEN) return new Map();
  const response = await fetch(`${NOTION_API}/data_sources/${SONGS_SOURCE_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ page_size: 100 })
  });
  if (!response.ok) return new Map();
  const data = await response.json();
  return new Map((data.results || []).map(page => {
    const props = page.properties || {};
    return [page.id, {
      sourceType: props['音源类型']?.select?.name || null,
      sourceUrl: props['音源链接']?.url || null,
      coverUrl: props['封面链接']?.url || null
    }];
  }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health/radio') {
      return new Response(JSON.stringify({ status: 'ok', radioSourceBridge: true, version: 2 }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }

    const response = await appWorker.fetch(request, env, ctx);
    if (request.method !== 'GET' || url.pathname !== '/api/songs' || !response.ok) return response;

    try {
      const payload = await response.clone().json();
      if (!Array.isArray(payload?.items)) return response;
      const extraById = await notionSongs(env);
      payload.items = payload.items.map(item => ({ ...item, ...(extraById.get(item.id) || {}) }));
      return new Response(JSON.stringify(payload), {
        status: response.status,
        headers: response.headers
      });
    } catch {
      return response;
    }
  }
};
