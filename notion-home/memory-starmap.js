(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const MODE_KEY = 'keatsHome.memoryView';
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  let items = [];
  let loadedAt = 0;
  let loading = null;

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function hash(value = '') {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function importance(item) {
    const raw = String(item.importance || '');
    const stars = (raw.match(/⭐/g) || []).length;
    if (stars) return Math.max(1, Math.min(5, stars));
    const number = Number(raw.match(/\d+/)?.[0]);
    return Number.isFinite(number) ? Math.max(1, Math.min(5, number)) : 3;
  }

  function textOf(item) {
    return [item.title, item.text, item.module, item.category, item.type, item.ruleType]
      .filter(Boolean).join(' · ');
  }

  function relationTags(item) {
    const tags = new Set();
    [item.module, item.category, item.type, item.ruleType].filter(Boolean).forEach(value => tags.add(`meta:${String(value).trim()}`));
    const text = textOf(item);
    const groups = [
      ['home', /小家|Keats Home|回家|家门|网站|前端|纸条|爪印/i],
      ['keats', /Keats|豹豹/i],
      ['kitten', /小猫|猫猫/i],
      ['diary', /日记|碎碎念|写法/i],
      ['name', /称呼|名字|昵称/i],
      ['rule', /规则|约定|偏好|记住/i],
      ['letter', /信箱|写信|留言|信/i],
      ['photo', /相册|照片|画像|形象/i]
    ];
    groups.forEach(([name, pattern]) => { if (pattern.test(text)) tags.add(`topic:${name}`); });
    return tags;
  }

  function positions(list) {
    const width = 1000;
    const height = 620;
    const centerX = width / 2;
    const centerY = height / 2;
    const golden = Math.PI * (3 - Math.sqrt(5));
    return list.map((item, index) => {
      const seed = hash(`${item.id || ''}${item.title || ''}`);
      const ratio = Math.sqrt((index + 1) / Math.max(list.length, 1));
      const angle = index * golden + ((seed % 1000) / 1000 - .5) * .55;
      const radius = 70 + ratio * 245 + ((seed >>> 9) % 38);
      const squash = .73;
      const x = Math.max(62, Math.min(width - 62, centerX + Math.cos(angle) * radius));
      const y = Math.max(56, Math.min(height - 56, centerY + Math.sin(angle) * radius * squash));
      return { x, y };
    });
  }

  function buildEdges(list, pos) {
    const tagSets = list.map(relationTags);
    const candidates = [];
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const shared = [...tagSets[i]].filter(tag => tagSets[j].has(tag));
        if (!shared.length) continue;
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const score = shared.length * 1000 - distance;
        candidates.push({ a: i, b: j, score, shared });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const degree = Array(list.length).fill(0);
    const chosen = [];
    for (const edge of candidates) {
      if (degree[edge.a] >= 2 || degree[edge.b] >= 2) continue;
      chosen.push(edge);
      degree[edge.a] += 1;
      degree[edge.b] += 1;
      if (chosen.length >= Math.max(0, list.length - 1)) break;
    }
    return chosen;
  }

  function formatDate(value = '') {
    if (!value) return '';
    try {
      const date = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
      if (Number.isNaN(date.getTime())) return value;
      return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date);
    } catch {
      return value;
    }
  }

  async function loadMemories(force = false) {
    if (!force && items.length && Date.now() - loadedAt < 60 * 1000) return items;
    if (loading) return loading;
    loading = (async () => {
      const token = sessionStorage.getItem(SESSION_KEY);
      if (!token) throw new Error('先把小家的门打开，我才能把记忆星空点亮。');
      const response = await fetch(`${API_BASE}/api/memories?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '记忆星图暂时没有亮起来。');
      items = (data.items || []).slice(0, 60);
      loadedAt = Date.now();
      return items;
    })().finally(() => { loading = null; });
    return loading;
  }

  function setSelected(index) {
    const host = qs('#memoryStarMap');
    if (!host) return;
    const item = items[index];
    if (!item) return;
    qsa('.memory-star', host).forEach((node, i) => node.classList.toggle('is-selected', i === index));
    qsa('.memory-constellation-line', host).forEach(line => {
      const on = Number(line.dataset.a) === index || Number(line.dataset.b) === index;
      line.classList.toggle('is-related', on);
    });
    const detail = qs('.memory-star-detail', host);
    const meta = [item.category || item.module || item.type, formatDate(item.date)].filter(Boolean).join(' · ');
    detail.innerHTML = `
      <small>${esc(meta || '一枚被收好的记忆')}</small>
      <h3>${esc(item.title || '一枚记忆')}</h3>
      <p>${esc(item.text || '这枚记忆安静地亮在这里。')}</p>
      <div class="memory-star-detail-foot">
        <span>${'⭐'.repeat(importance(item))}</span>
        ${item.url ? '<button type="button" id="openMemoryStar">打开这枚记忆 →</button>' : ''}
      </div>`;
    if (item.url) qs('#openMemoryStar', detail)?.addEventListener('click', () => { window.location.href = item.url; });
  }

  function render(list) {
    const host = qs('#memoryStarMap');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<div class="memory-stars-empty"><span>✦</span><b>星空还空着。</b><p>以后每收进一枚记忆，这里就多亮一颗。</p></div>';
      return;
    }
    const pos = positions(list);
    const edges = buildEdges(list, pos);
    const lines = edges.map(edge => `<line class="memory-constellation-line" data-a="${edge.a}" data-b="${edge.b}" x1="${pos[edge.a].x}" y1="${pos[edge.a].y}" x2="${pos[edge.b].x}" y2="${pos[edge.b].y}" />`).join('');
    const stars = list.map((item, index) => {
      const level = importance(item);
      const label = item.title || '一枚记忆';
      return `<button class="memory-star level-${level}" type="button" data-memory-star="${index}" style="left:${(pos[index].x / 10).toFixed(2)}%;top:${(pos[index].y / 6.2).toFixed(2)}%" aria-label="${esc(label)}">
        <i></i><span>${esc(label)}</span>
      </button>`;
    }).join('');
    host.innerHTML = `
      <div class="memory-starmap-stage">
        <div class="memory-stardust" aria-hidden="true"></div>
        <svg class="memory-constellation-lines" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        <div class="memory-stars-layer">${stars}</div>
      </div>
      <aside class="memory-star-detail" aria-live="polite"></aside>
      <div class="memory-starmap-legend"><span>暗一点</span><i></i><i></i><i></i><i></i><i></i><span>更重要</span><em>星线 = 同类记忆或共同主题</em></div>`;

    qsa('[data-memory-star]', host).forEach(button => {
      button.addEventListener('click', () => setSelected(Number(button.dataset.memoryStar)));
      button.addEventListener('mouseenter', () => {
        const index = Number(button.dataset.memoryStar);
        qsa('.memory-constellation-line', host).forEach(line => {
          const on = Number(line.dataset.a) === index || Number(line.dataset.b) === index;
          line.classList.toggle('is-hovered', on);
        });
      });
      button.addEventListener('mouseleave', () => qsa('.memory-constellation-line.is-hovered', host).forEach(line => line.classList.remove('is-hovered')));
    });
    setSelected(0);
  }

  async function showStars() {
    const host = qs('#memoryStarMap');
    if (!host) return;
    host.innerHTML = '<div class="memory-stars-loading"><span>✦</span><b>正在把记忆一颗颗挂上去……</b></div>';
    try {
      render(await loadMemories());
    } catch (error) {
      host.innerHTML = `<div class="memory-stars-empty"><span>☾</span><b>星图还没亮。</b><p>${esc(error.message || '晚一点再来。')}</p></div>`;
    }
  }

  function setMode(mode, remember = true) {
    const board = qs('#view-memories .memory-board');
    const starMap = qs('#memoryStarMap');
    const switcher = qs('#memoryViewSwitch');
    if (!board || !starMap || !switcher) return;
    const stars = mode === 'stars';
    board.hidden = stars;
    starMap.hidden = !stars;
    qsa('[data-memory-mode]', switcher).forEach(button => button.classList.toggle('is-active', button.dataset.memoryMode === mode));
    if (remember) localStorage.setItem(MODE_KEY, mode);
    if (stars) showStars();
  }

  function boot() {
    const switcher = qs('#memoryViewSwitch');
    if (!switcher || switcher.dataset.bound === '1') return;
    switcher.dataset.bound = '1';
    switcher.addEventListener('click', event => {
      const button = event.target.closest('[data-memory-mode]');
      if (!button) return;
      setMode(button.dataset.memoryMode);
    });
    const saved = localStorage.getItem(MODE_KEY);
    setMode(saved === 'stars' ? 'stars' : 'cards', false);
  }

  window.addEventListener('pageshow', boot);
  window.addEventListener('hashchange', () => setTimeout(boot, 120));
  setTimeout(boot, 520);
})();
