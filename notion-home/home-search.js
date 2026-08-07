(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const CACHE_MS = 60 * 1000;
  const qs = (selector, scope = document) => scope.querySelector(selector);

  const rooms = [
    { kind: 'room', view: 'home', icon: '⌂', room: '首页', title: '首页', text: '欢迎回家，小猫。' },
    { kind: 'room', view: 'diary', icon: '✎', room: '日记本', title: '日记本', text: '每天的碎碎念和小情绪' },
    { kind: 'room', view: 'letters', icon: '✉', room: '信箱', title: '信箱', text: '长信、留言和小纸条' },
    { kind: 'room', view: 'pawprints', icon: '🐾', room: '爪印', title: '豹豹留下的爪印', text: 'Keats 自己的小念头' },
    { kind: 'room', view: 'memories', icon: '✦', room: '记忆库', title: '记忆库', text: '规则、暗号、偏好与重要节点' },
    { kind: 'room', view: 'timeline', icon: '⌁', room: '时间线', title: '我们的时间线', text: '以后值得翻回来的节点' },
    { kind: 'room', view: 'album', icon: '▣', room: '相册', title: '相册', text: '照片、形象图、表情包和专属区' },
    { kind: 'room', view: 'quotes', icon: '❝', room: '我们说过的话', title: '我们说过的话', text: '值得单独留下来的句子' },
    { kind: 'room', view: 'songs', icon: '♫', room: '歌单', title: '歌单', text: '小家的背景音乐' }
  ];

  const sourceConfig = [
    { key: 'diary', path: '/api/diary?limit=100', icon: '✎', room: '日记本', view: 'diary' },
    { key: 'letters', path: '/api/letters?limit=100', icon: '✉', room: '信箱', view: 'letters' },
    { key: 'pawprints', path: '/api/pawprints', icon: '🐾', room: '爪印', view: 'pawprints' },
    { key: 'memories', path: '/api/memories?limit=100', icon: '✦', room: '记忆库', view: 'memories' },
    { key: 'timeline', path: '/api/timeline?limit=100', icon: '⌁', room: '时间线', view: 'timeline' },
    { key: 'quotes', path: '/api/quotes?limit=100', icon: '❝', room: '我们说过的话', view: 'quotes' },
    { key: 'songs', path: '/api/songs?limit=100', icon: '♫', room: '歌单', view: 'songs' },
    { key: 'notes', path: '/api/notes?limit=100', icon: '▱', room: '今日小纸条', view: 'home' }
  ];

  let overlay = null;
  let input = null;
  let resultsHost = null;
  let metaHost = null;
  let records = [];
  let loadedAt = 0;
  let loadingPromise = null;
  let activeIndex = 0;
  let visibleResults = [];

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value = '') {
    return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function formatDate(value = '') {
    if (!value) return '';
    try {
      const date = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
      if (Number.isNaN(date.getTime())) return value;
      return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
    } catch {
      return value;
    }
  }

  function fieldText(item, key) {
    const fields = {
      diary: [item.title, item.summary, item.author, item.date, ...(item.moods || []), ...(item.types || []), item.keatsState, item.catState, ...(item.catStates || [])],
      letters: [item.title, item.summary, item.author, item.recipient, item.category, item.status, item.date],
      pawprints: [item.title, item.body],
      memories: [item.title, item.text, item.module, item.status, item.ruleType, item.category, item.type, item.importance, item.date],
      timeline: [item.title, item.note, item.type, item.status, item.date],
      quotes: [item.title, item.quote, item.tone, ...(item.feelings || []), item.source, item.starter, item.aside, item.date],
      songs: [item.title, item.artist, item.recommender, ...(item.moods || []), item.reason],
      notes: [item.title, item.content, item.author, item.date]
    };
    return (fields[key] || []).filter(Boolean).join(' · ');
  }

  function titleOf(item, key) {
    if (key === 'quotes') return item.title || item.quote || '一段话';
    if (key === 'songs') return item.title || item.artist || '一首歌';
    if (key === 'notes') return item.content || item.title || '一张小纸条';
    return item.title || '一条记录';
  }

  function descOf(item, key) {
    if (key === 'diary') return item.summary || [item.author, ...(item.moods || [])].filter(Boolean).join(' · ');
    if (key === 'letters') return item.summary || [item.author, item.recipient].filter(Boolean).join(' → ');
    if (key === 'pawprints') return item.body || '豹豹踩过的一枚爪印';
    if (key === 'memories') return item.text || [item.category, item.type].filter(Boolean).join(' · ');
    if (key === 'timeline') return item.note || [item.type, item.status].filter(Boolean).join(' · ');
    if (key === 'quotes') return item.quote || item.aside || '';
    if (key === 'songs') return [item.artist, item.reason].filter(Boolean).join(' · ');
    if (key === 'notes') return `${item.author === 'Keats' ? '🐆 Keats' : '🐈 小猫'} · ${formatDate(item.date)}`;
    return '';
  }

  function buildRecord(item, config) {
    return {
      kind: config.key,
      id: item.id || '',
      icon: config.icon,
      room: config.room,
      view: config.view,
      title: titleOf(item, config.key),
      desc: descOf(item, config.key),
      date: item.date || item.createdTime || '',
      author: item.author || item.recommender || '',
      url: item.url || '',
      needle: normalize(fieldText(item, config.key)),
      raw: item
    };
  }

  async function api(path) {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) throw Object.assign(new Error('先用小家钥匙开一次门。'), { status: 401 });
    const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || '这个抽屉暂时没翻开。'), { status: response.status });
    return data;
  }

  async function loadIndex(force = false) {
    if (!force && records.length && Date.now() - loadedAt < CACHE_MS) return records;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      const settled = await Promise.allSettled(sourceConfig.map(async config => ({ config, data: await api(config.path) })));
      const next = [];
      let roomsLoaded = 0;
      settled.forEach(result => {
        if (result.status !== 'fulfilled') return;
        roomsLoaded += 1;
        const { config, data } = result.value;
        (data.items || []).forEach(item => next.push(buildRecord(item, config)));
      });
      records = next;
      loadedAt = Date.now();
      if (metaHost) metaHost.textContent = roomsLoaded
        ? `已经翻开 ${roomsLoaded} 个房间 · ${records.length} 条可搜索的痕迹`
        : '房间门还没完全打开';
      return records;
    })().finally(() => { loadingPromise = null; });
    return loadingPromise;
  }

  function score(record, query) {
    const q = normalize(query);
    if (!q) return 0;
    const title = normalize(record.title);
    const desc = normalize(record.desc);
    const room = normalize(record.room);
    let value = 0;
    if (title === q) value += 120;
    if (title.startsWith(q)) value += 80;
    else if (title.includes(q)) value += 58;
    if (desc.includes(q)) value += 28;
    if (record.needle.includes(q)) value += 22;
    if (room.includes(q)) value += 12;
    const pieces = q.split(' ').filter(Boolean);
    pieces.forEach(piece => {
      if (title.includes(piece)) value += 18;
      if (record.needle.includes(piece)) value += 7;
    });
    return value;
  }

  function highlight(text, query) {
    const safe = esc(text);
    const q = String(query || '').trim();
    if (!q) return safe;
    const parts = [...new Set(q.split(/\s+/).filter(Boolean))].sort((a, b) => b.length - a.length);
    if (!parts.length) return safe;
    const escapedParts = parts.map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    try {
      const re = new RegExp(`(${escapedParts.join('|')})`, 'ig');
      return safe.replace(re, '<mark>$1</mark>');
    } catch {
      return safe;
    }
  }

  function roomMatches(query) {
    const q = normalize(query);
    if (!q) return rooms.slice(0, 6);
    return rooms.filter(room => normalize(`${room.title} ${room.text} ${room.room}`).includes(q)).slice(0, 4);
  }

  function search(query) {
    const q = normalize(query);
    if (!q) return roomMatches('').map(room => ({ ...room, score: 1 }));
    const data = records
      .map(record => ({ ...record, score: score(record, q) }))
      .filter(record => record.score > 0)
      .sort((a, b) => b.score - a.score || String(b.date).localeCompare(String(a.date)))
      .slice(0, 28);
    return [...roomMatches(q).map(room => ({ ...room, score: 999 })), ...data].slice(0, 30);
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="whole-home-search" id="wholeHomeSearch" aria-hidden="true">
        <section class="whole-home-search-card" role="dialog" aria-modal="true" aria-labelledby="wholeHomeSearchTitle">
          <header class="whole-home-search-head">
            <div class="whole-home-search-inputrow">
              <span class="whole-home-search-glyph">⌕</span>
              <input id="wholeHomeSearchInput" autocomplete="off" placeholder="想翻哪一段生活？" aria-label="搜索小家" />
              <kbd>ESC</kbd>
            </div>
            <div class="whole-home-search-titleline">
              <span id="wholeHomeSearchTitle">搜整个小家</span>
              <small id="wholeHomeSearchMeta">日记、纸条、信、爪印、记忆……都在这里。</small>
            </div>
          </header>
          <div class="whole-home-search-results" id="wholeHomeSearchResults"></div>
          <footer class="whole-home-search-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span>🐈 · 🐆</span>
          </footer>
        </section>
      </div>`);
    overlay = qs('#wholeHomeSearch');
    input = qs('#wholeHomeSearchInput', overlay);
    resultsHost = qs('#wholeHomeSearchResults', overlay);
    metaHost = qs('#wholeHomeSearchMeta', overlay);

    overlay.addEventListener('mousedown', event => {
      if (event.target === overlay) close();
    });
    input.addEventListener('input', () => {
      activeIndex = 0;
      render(input.value);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
      if (event.key === 'Enter') { event.preventDefault(); activate(); }
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    return overlay;
  }

  function render(query = '') {
    ensureOverlay();
    visibleResults = search(query);
    if (activeIndex >= visibleResults.length) activeIndex = 0;
    if (!visibleResults.length) {
      resultsHost.innerHTML = `<div class="whole-home-search-empty"><span>⌕</span><b>没有翻到这句话。</b><small>换个词试试，或者只记得半句话也行。</small></div>`;
      return;
    }

    const q = query.trim();
    resultsHost.innerHTML = visibleResults.map((item, index) => {
      const room = item.kind === 'room' ? '房间' : item.room;
      const date = item.kind === 'room' ? '' : formatDate(item.date);
      const desc = item.text || item.desc || '';
      return `<button class="whole-home-search-result ${index === activeIndex ? 'is-active' : ''}" type="button" data-result-index="${index}">
        <span class="whole-home-search-result-icon">${item.icon || '·'}</span>
        <span class="whole-home-search-result-copy">
          <span class="whole-home-search-result-meta"><b>${esc(room)}</b>${date ? `<i>${esc(date)}</i>` : ''}</span>
          <strong>${highlight(item.title, q)}</strong>
          <small>${highlight(desc, q)}</small>
        </span>
        <span class="whole-home-search-arrow">→</span>
      </button>`;
    }).join('');

    resultsHost.querySelectorAll('[data-result-index]').forEach(button => {
      button.addEventListener('mouseenter', () => {
        activeIndex = Number(button.dataset.resultIndex) || 0;
        paintActive();
      });
      button.addEventListener('click', () => {
        activeIndex = Number(button.dataset.resultIndex) || 0;
        activate();
      });
    });
  }

  function paintActive() {
    resultsHost?.querySelectorAll('[data-result-index]').forEach((button, index) => {
      button.classList.toggle('is-active', index === activeIndex);
    });
  }

  function move(delta) {
    if (!visibleResults.length) return;
    activeIndex = (activeIndex + delta + visibleResults.length) % visibleResults.length;
    paintActive();
    resultsHost.querySelector(`[data-result-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function glowTarget(selector, predicate) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const nodes = [...document.querySelectorAll(selector)];
      const target = nodes.find(node => predicate(normalize(node.textContent || '')));
      if (target) {
        clearInterval(timer);
        target.classList.add('whole-home-search-found');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => target.classList.remove('whole-home-search-found'), 2600);
      }
      if (tries > 20) clearInterval(timer);
    }, 180);
  }

  function showHome() {
    if (location.hash === '#home' || !location.hash) {
      location.hash = 'home';
    } else {
      location.hash = 'home';
    }
    setTimeout(() => {
      if (location.hash === '#home') history.replaceState(null, '', location.pathname);
    }, 180);
  }

  function goToRoom(view) {
    close();
    if (view === 'home') {
      showHome();
      return;
    }
    location.hash = view;
  }

  function activate() {
    const item = visibleResults[activeIndex];
    if (!item) return;
    if (item.kind === 'room') {
      goToRoom(item.view);
      return;
    }
    if (item.url) {
      window.location.href = item.url;
      return;
    }
    if (item.kind === 'notes') {
      const needle = normalize(item.raw?.content || item.title);
      close();
      showHome();
      setTimeout(() => {
        const details = qs('#pastNotes');
        if (details) details.open = true;
        glowTarget('#littleNotesBoard .little-note, #littleNotesBoard .past-note-row', text => text.includes(needle.slice(0, Math.min(needle.length, 28))));
      }, 300);
      return;
    }
    if (item.kind === 'pawprints') {
      const needle = normalize(item.raw?.title || item.title);
      close();
      location.hash = 'pawprints';
      setTimeout(() => glowTarget('#view-pawprints article, #view-pawprints button, #view-pawprints [class*="paw"]', text => text.includes(needle.slice(0, Math.min(needle.length, 24)))), 260);
      return;
    }
    goToRoom(item.view);
  }

  async function open() {
    ensureOverlay();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    input.value = '';
    activeIndex = 0;
    render('');
    setTimeout(() => input.focus(), 40);

    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      metaHost.textContent = '先开一次小家的门，就能搜索所有真实内容。';
      return;
    }
    metaHost.textContent = records.length ? '正在看看家里有没有新东西……' : '正在把各个房间的抽屉翻开……';
    try {
      await loadIndex();
      render(input.value);
    } catch (error) {
      metaHost.textContent = error.message || '搜索抽屉暂时没翻开。';
    }
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('#searchTrigger')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  }, true);

  document.addEventListener('keydown', event => {
    const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (commandK) {
      event.preventDefault();
      event.stopImmediatePropagation();
      overlay?.classList.contains('is-open') ? close() : open();
      return;
    }
    if (event.key === 'Escape' && overlay?.classList.contains('is-open')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }, true);

  window.addEventListener('keats-home:data-changed', () => { loadedAt = 0; });
})();