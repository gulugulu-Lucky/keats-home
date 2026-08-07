(() => {
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';

  const views = qsa('.view');
  const navButtons = qsa('[data-view]');
  const sidebar = qs('#sidebar');
  const crumbTitle = qs('#crumbTitle');
  const editorModal = qs('#editorModal');
  const searchModal = qs('#searchModal');
  const commandInput = qs('#commandInput');
  const commandResults = qs('#commandResults');
  const toast = qs('#toast');
  const entryTitle = qs('#entryTitle');
  const entryContent = qs('#entryContent');
  const editorTitle = qs('#editorTitle');
  const editorDate = qs('#editorDate');
  const syncPill = qs('.sync-pill');

  let currentView = 'home';
  let currentEntryKind = '日记';
  let focusedSearchIndex = 0;
  let homeData = {};

  const searchIndex = [
    { view: 'home', icon: '⌂', title: '首页', desc: '欢迎回家，小猫。' },
    { view: 'diary', icon: '✎', title: '日记本', desc: '每天的碎碎念和小情绪' },
    { view: 'letters', icon: '✉', title: '信箱', desc: '长信、留言和小纸条' },
    { view: 'pawprints', icon: '🐾', title: '豹豹留下的爪印', desc: 'Keats 自己的小念头' },
    { view: 'memories', icon: '✦', title: '记忆库', desc: '规则、暗号、偏好与重要节点' },
    { view: 'timeline', icon: '⌁', title: '我们的时间线', desc: '以后值得翻回来的节点' },
    { view: 'album', icon: '▣', title: '相册', desc: '想一直留着的画面' },
    { view: 'quotes', icon: '❝', title: '我们说过的话', desc: '单独值得留下来的句子' },
    { view: 'songs', icon: '♫', title: '歌单', desc: '小家的背景音乐' }
  ];

  const kindByView = {
    diary: '日记',
    letters: '信',
    pawprints: '爪印',
    memories: '记忆',
    home: '日记'
  };

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value, fallback = '最近') {
    if (!value) return fallback;
    const date = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date);
  }

  function setDate() {
    const now = new Date();
    const full = new Intl.DateTimeFormat('zh-CN', {
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(now);
    const short = new Intl.DateTimeFormat('en-GB', {
      month: '2-digit', day: '2-digit'
    }).format(now).replace('/', ' / ');
    qs('#todayText').textContent = full;
    qs('#shortDate').textContent = short;
    editorDate.textContent = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(now);
  }

  function switchView(name, options = {}) {
    const target = qs(`#view-${name}`);
    if (!target) return;

    currentView = name;
    views.forEach(view => view.classList.toggle('is-visible', view === target));
    qsa('.nav-item').forEach(button => button.classList.toggle('is-active', button.dataset.view === name));
    qsa('.mobile-bottom-nav [data-view]').forEach(button => button.classList.toggle('is-active', button.dataset.view === name));

    const title = target.dataset.title || 'Keats Home';
    crumbTitle.textContent = title;
    document.title = name === 'home' ? 'Keats Home · 欢迎回家，小猫。' : `${title} · Keats Home`;

    if (!options.skipHash) {
      history.replaceState(null, '', name === 'home' ? location.pathname : `${location.pathname}#${name}`);
    }

    if (window.innerWidth <= 820) sidebar.classList.remove('is-open');
    window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
  }

  function openEditor(kind = '日记') {
    currentEntryKind = kind;
    editorTitle.textContent = ({
      '日记': '写一点今天',
      '信': '写一封信',
      '爪印': '踩一枚新爪印',
      '记忆': '收进一枚记忆'
    })[kind] || '写一点东西';

    const placeholderByKind = {
      '日记': '比如：今天有一个瞬间，我很想留下来',
      '信': '比如：给小猫｜今晚想说的话',
      '爪印': '比如：刚刚发现自己又偷偷开心了',
      '记忆': '比如：以后提到这个，就知道是什么意思'
    };

    entryTitle.placeholder = placeholderByKind[kind] || '给它起个名字';
    entryTitle.value = '';
    entryContent.value = '';
    editorModal.classList.add('is-open');
    editorModal.setAttribute('aria-hidden', 'false');
    const note = qs('.draft-note', editorModal);
    if (note) note.textContent = sessionStorage.getItem(SESSION_KEY)
      ? '会直接保存到 Notion 小家里'
      : '先点顶部同步状态，用小家钥匙开门';
    const saveButton = qs('#saveDraft');
    if (saveButton) saveButton.textContent = sessionStorage.getItem(SESSION_KEY) ? '保存到小家' : '先开门';
    setTimeout(() => entryTitle.focus(), 80);
  }

  function closeEditor() {
    editorModal.classList.remove('is-open');
    editorModal.setAttribute('aria-hidden', 'true');
  }

  function showToast(title = '已经放好啦', detail = 'Notion 小家已同步') {
    const titleNode = qs('b', toast);
    const detailNode = qs('small', toast);
    if (titleNode) titleNode.textContent = title;
    if (detailNode) detailNode.textContent = detail;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
  }

  function setConnectionStatus(state, text) {
    if (!syncPill) return;
    syncPill.innerHTML = `<i></i> ${esc(text)}`;
    syncPill.style.cursor = 'pointer';
    syncPill.title = state === 'ready' ? 'Notion 已连接 · 点击重新验证' : '点击用小家钥匙开门';
    syncPill.dataset.state = state;
  }

  async function publicFetch(path, init = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || data.message || '请求失败'), { status: response.status, data });
    return data;
  }

  async function apiFetch(path, init = {}) {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) throw Object.assign(new Error('请先打开小家'), { status: 401 });
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        setConnectionStatus('locked', '后端在线 · 点此开门');
      }
      throw Object.assign(new Error(data.error || data.message || '请求失败'), { status: response.status, data });
    }
    return data;
  }

  function installConnectionModal() {
    if (qs('#connectionModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-backdrop" id="connectionModal" aria-hidden="true">
        <section class="editor-modal" role="dialog" aria-modal="true" aria-labelledby="connectionTitle" style="max-width:460px;">
          <header>
            <div><span class="eyebrow">PRIVATE DOOR</span><h2 id="connectionTitle">打开我们的小家</h2></div>
            <button class="icon-button" id="connectionClose" type="button">×</button>
          </header>
          <p style="margin:0 0 16px;color:var(--muted);line-height:1.8;">钥匙只用来向后端换一张 12 小时的临时门票，不会写进 GitHub，也不会保存在网页代码里。</p>
          <label>小家钥匙<input id="homeKeyInput" type="password" autocomplete="current-password" placeholder="••••••••••••••••" /></label>
          <p id="connectionError" style="min-height:20px;margin:0;color:#a85d57;font-size:12px;"></p>
          <footer>
            <span class="draft-note">原始钥匙不会被浏览器记住</span>
            <div><button class="soft-button" id="connectionCancel" type="button">取消</button><button class="primary-button" id="connectionSubmit" type="button">开门</button></div>
          </footer>
        </section>
      </div>`);

    const modal = qs('#connectionModal');
    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      qs('#homeKeyInput').value = '';
      qs('#connectionError').textContent = '';
    };
    qs('#connectionClose').addEventListener('click', close);
    qs('#connectionCancel').addEventListener('click', close);
    modal.addEventListener('mousedown', event => { if (event.target === modal) close(); });
    qs('#homeKeyInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') qs('#connectionSubmit').click();
    });
    qs('#connectionSubmit').addEventListener('click', async () => {
      const keyInput = qs('#homeKeyInput');
      const errorNode = qs('#connectionError');
      const button = qs('#connectionSubmit');
      const key = keyInput.value;
      if (!key) {
        errorNode.textContent = '钥匙还没填呀。';
        keyInput.focus();
        return;
      }
      button.disabled = true;
      button.textContent = '开门中…';
      errorNode.textContent = '';
      try {
        const result = await publicFetch('/auth/login', { method: 'POST', body: JSON.stringify({ key }) });
        sessionStorage.setItem(SESSION_KEY, result.token);
        keyInput.value = '';
        close();
        setConnectionStatus('ready', 'Notion 已连接');
        showToast('门开啦', '正在把 Notion 里的小家搬进来');
        await loadAllData();
      } catch (error) {
        errorNode.textContent = error.status === 401 ? '这把钥匙不对，再想想。' : `开门失败：${error.message}`;
      } finally {
        button.disabled = false;
        button.textContent = '开门';
      }
    });
  }

  function openConnectionModal() {
    installConnectionModal();
    const modal = qs('#connectionModal');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => qs('#homeKeyInput')?.focus(), 80);
  }

  async function checkBackend() {
    setConnectionStatus('checking', '正在摸后端…');
    try {
      const deep = await publicFetch('/health/notion');
      if (!deep.notionReachable) throw new Error(deep.message || 'Notion 暂时没接通');
      if (sessionStorage.getItem(SESSION_KEY)) {
        try {
          await apiFetch('/api/diary?limit=1');
          setConnectionStatus('ready', 'Notion 已连接');
          return true;
        } catch (error) {
          if (error.status !== 401) throw error;
        }
      }
      setConnectionStatus('locked', '后端在线 · 点此开门');
      return false;
    } catch (error) {
      setConnectionStatus('error', '后端还没接稳');
      console.warn('Backend check failed:', error);
      return false;
    }
  }

  function setNavCount(view, count) {
    const node = qs(`.nav-item[data-view="${view}"] i`);
    if (node) node.textContent = Number.isFinite(count) ? String(count) : '';
  }

  function renderDiary(items = []) {
    const host = qs('#view-diary .entry-grid');
    if (!host) return;
    host.innerHTML = items.length ? items.slice(0, 24).map(item => `
      <article class="entry-card" ${item.url ? `data-open-url="${esc(item.url)}"` : ''}>
        <div class="entry-meta"><span>${esc(formatDate(item.date))}</span><i>${esc(item.author || '')}</i></div>
        <h3>${esc(item.title || '未命名日记')}</h3>
        <p>${esc(item.summary || '这一天留下了一页。')}</p>
        <div class="entry-tags">${(item.types || []).slice(0, 2).map(tag => `<span>${esc(tag)}</span>`).join('')}${(item.moods || []).slice(0, 1).map(tag => `<span>${esc(tag)}</span>`).join('')}</div>
      </article>`).join('') : '<div class="paper-card" style="padding:28px;">日记本还安安静静的。</div>';
    setNavCount('diary', items.length);
  }

  function renderLetters(items = []) {
    const host = qs('#view-letters .mail-stack');
    if (!host) return;
    host.innerHTML = items.length ? items.slice(0, 20).map((item, index) => `
      <article class="mail-item ${index === 0 ? 'unread' : ''}" ${item.url ? `data-open-url="${esc(item.url)}"` : ''}>
        <span class="mail-seal">${item.author === 'Keats' ? 'K' : '🐾'}</span>
        <div><small>${esc(item.author || '')} → ${esc(item.recipient || '')} · ${esc(formatDate(item.date))}</small><h3>${esc(item.title || '一封没有标题的信')}</h3><p>${esc(item.summary || '')}</p></div>
        <time>${esc(item.status || item.category || '')}</time>
      </article>`).join('') : '<div class="paper-card" style="padding:28px;">信箱里现在很安静。</div>';
    setNavCount('letters', items.length);
  }

  function renderPawprints(items = []) {
    const host = qs('#view-pawprints .pawprint-list');
    if (!host) return;
    host.innerHTML = items.length ? items.slice().reverse().map((item, index) => `
      <article><span>${String(items.length - index).padStart(2, '0')}</span><div><h3>${esc(item.title || '一枚小爪印')}</h3><p>${esc(item.body || '')}</p></div><time>🐾</time></article>`).join('') : '<div class="paper-card" style="padding:28px;">豹豹还没踩下第一枚爪印。</div>';
    setNavCount('pawprints', items.length);
    const pawCount = qs('.paw-row small');
    if (pawCount) pawCount.textContent = `现在收着 ${items.length} 个小念头`;
  }

  function renderMemories(items = []) {
    const host = qs('#view-memories .memory-board');
    if (!host) return;
    const colors = ['gold', 'blue', 'violet', 'paper'];
    host.innerHTML = items.length ? items.slice(0, 24).map((item, index) => `
      <article class="memory-tile ${colors[index % colors.length]}" ${item.url ? `data-open-url="${esc(item.url)}"` : ''}>
        <span>${esc(item.type || item.module || '记忆')}</span><h3>${esc(item.title || '一枚记忆')}</h3><p>${esc(item.text || '')}</p><small>${esc(item.importance || '')}</small>
      </article>`).join('') : '<div class="paper-card" style="padding:28px;">记忆库还空着一格。</div>';
    setNavCount('memories', items.length);
    const count = qs('.memory-count strong');
    if (count) count.textContent = String(items.length);
  }

  function renderTimeline(items = []) {
    const host = qs('#view-timeline .timeline-list');
    if (!host) return;
    host.innerHTML = items.length ? items.slice(0, 30).map(item => `
      <article ${item.url ? `data-open-url="${esc(item.url)}"` : ''}><time>${esc(item.date || '以后')}</time><i></i><div><span>${esc(item.type || item.status || '节点')}</span><h3>${esc(item.title || '一个节点')}</h3><p>${esc(item.note || '')}</p></div></article>`).join('') : '<div class="paper-card" style="padding:28px;">时间线会慢慢长出来。</div>';
  }

  function renderQuotes(items = []) {
    const host = qs('#view-quotes .quote-wall');
    if (!host) return;
    host.innerHTML = items.length ? items.slice(0, 24).map(item => `
      <blockquote ${item.url ? `data-open-url="${esc(item.url)}"` : ''}><span>“</span>${esc(item.quote || item.title || '')}<footer>— ${esc(item.starter || item.source || '我们')}</footer></blockquote>`).join('') : '<div class="paper-card" style="padding:28px;">还没有单独收起来的话。</div>';
  }

  function renderSongs(items = []) {
    const host = qs('#view-songs .song-list');
    if (!host) return;
    host.innerHTML = items.length ? items.slice(0, 30).map((item, index) => `
      <article ${item.url ? `data-open-url="${esc(item.url)}"` : ''}><span class="track-number">${String(index + 1).padStart(2, '0')}</span><div><h3>${esc(item.title || '未命名歌曲')}</h3><p>${esc(item.artist || item.recommender || '')}</p></div><span class="song-tag">${esc((item.moods || [])[0] || '♪')}</span><button type="button">♡</button></article>`).join('') : '<div class="paper-card" style="padding:28px;">歌单还没有响起来。</div>';
    bindSongHearts();
  }

  function renderHome() {
    const diary = homeData.diary?.[0];
    const paper = qs('.diary-paper');
    if (paper && diary) {
      const title = qs('b', paper);
      const summary = qs('small', paper);
      if (title) title.textContent = diary.title || '今天的一页';
      if (summary) summary.textContent = diary.summary || '今天也被好好留住了。';
    }

    const traces = qs('.trace-list');
    if (traces) {
      const rows = [];
      const paw = homeData.pawprints?.slice(-1)[0];
      const letter = homeData.letters?.[0];
      if (paw) rows.push({ view: 'pawprints', icon: '🐾', title: paw.title, sub: paw.body, time: '爪印' });
      if (diary) rows.push({ view: 'diary', icon: '✎', title: diary.title, sub: diary.summary, time: formatDate(diary.date) });
      if (letter) rows.push({ view: 'letters', icon: '✉', title: letter.title, sub: letter.summary, time: formatDate(letter.date) });
      if (rows.length) traces.innerHTML = rows.map(row => `<button class="trace-row" data-view="${row.view}"><span class="trace-icon">${row.icon}</span><span><b>${esc(row.title || '')}</b><small>${esc(row.sub || '')}</small></span><time>${esc(row.time)}</time></button>`).join('');
    }
  }

  function bindOpenUrls() {
    qsa('[data-open-url]').forEach(node => {
      node.style.cursor = 'pointer';
      node.onclick = event => {
        if (event.target.closest('button')) return;
        window.open(node.dataset.openUrl, '_blank', 'noopener');
      };
    });
  }

  function bindSongHearts() {
    qsa('.song-list button').forEach(button => {
      button.onclick = () => {
        button.textContent = button.textContent === '♥' ? '♡' : '♥';
        button.style.color = button.textContent === '♥' ? 'var(--gold)' : '';
      };
    });
  }

  async function loadAllData() {
    const endpoints = {
      diary: '/api/diary?limit=40',
      letters: '/api/letters?limit=30',
      pawprints: '/api/pawprints',
      memories: '/api/memories?limit=40',
      timeline: '/api/timeline?limit=40',
      quotes: '/api/quotes?limit=40',
      songs: '/api/songs?limit=40'
    };

    const results = await Promise.allSettled(Object.entries(endpoints).map(async ([key, path]) => [key, await apiFetch(path)]));
    let loaded = 0;
    results.forEach(result => {
      if (result.status !== 'fulfilled') {
        console.warn('Notion section failed:', result.reason);
        return;
      }
      const [key, data] = result.value;
      homeData[key] = data.items || [];
      loaded += 1;
    });

    if (homeData.diary) renderDiary(homeData.diary);
    if (homeData.letters) renderLetters(homeData.letters);
    if (homeData.pawprints) renderPawprints(homeData.pawprints);
    if (homeData.memories) renderMemories(homeData.memories);
    if (homeData.timeline) renderTimeline(homeData.timeline);
    if (homeData.quotes) renderQuotes(homeData.quotes);
    if (homeData.songs) renderSongs(homeData.songs);
    renderHome();
    bindOpenUrls();
    bindDynamicViewButtons();

    if (loaded) setConnectionStatus('ready', `Notion 已连接 · ${loaded} 个房间`);
  }

  async function saveEntry() {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      closeEditor();
      openConnectionModal();
      showToast('还差一把钥匙', '开门以后再保存到 Notion');
      return;
    }

    const title = entryTitle.value.trim() || `未命名${currentEntryKind}`;
    const content = entryContent.value.trim();
    const author = qs('.editor-meta .chip.is-selected')?.textContent.trim() === 'Keats' ? 'Keats' : '小猫';
    const saveButton = qs('#saveDraft');
    saveButton.disabled = true;
    saveButton.textContent = '保存中…';
    try {
      await apiFetch('/api/entries', {
        method: 'POST',
        body: JSON.stringify({ kind: currentEntryKind, title, content, author })
      });
      closeEditor();
      showToast('已经放好啦', 'Notion 小家已同步');
      await loadAllData();
    } catch (error) {
      showToast('这次没放进去', error.message);
      if (error.status === 401) {
        closeEditor();
        openConnectionModal();
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = '保存到小家';
    }
  }

  function openSearch() {
    searchModal.classList.add('is-open');
    searchModal.setAttribute('aria-hidden', 'false');
    commandInput.value = '';
    focusedSearchIndex = 0;
    renderSearch('');
    setTimeout(() => commandInput.focus(), 60);
  }

  function closeSearch() {
    searchModal.classList.remove('is-open');
    searchModal.setAttribute('aria-hidden', 'true');
  }

  function filteredSearch(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return searchIndex;
    const staticMatches = searchIndex.filter(item => `${item.title} ${item.desc}`.toLowerCase().includes(normalized));
    const dataMatches = Object.entries(homeData).flatMap(([kind, items]) => (items || []).filter(item => `${item.title || ''} ${item.summary || item.text || item.note || item.quote || item.body || ''}`.toLowerCase().includes(normalized)).slice(0, 5).map(item => ({
      view: ({ diary: 'diary', letters: 'letters', pawprints: 'pawprints', memories: 'memories', timeline: 'timeline', quotes: 'quotes', songs: 'songs' })[kind],
      icon: ({ diary: '✎', letters: '✉', pawprints: '🐾', memories: '✦', timeline: '⌁', quotes: '❝', songs: '♫' })[kind],
      title: item.title || item.quote || '一条记录',
      desc: item.summary || item.text || item.note || item.body || item.artist || ''
    })));
    return [...staticMatches, ...dataMatches].slice(0, 20);
  }

  function renderSearch(query) {
    const results = filteredSearch(query);
    if (focusedSearchIndex >= results.length) focusedSearchIndex = 0;
    commandResults.innerHTML = results.length
      ? results.map((item, index) => `
        <button class="command-result ${index === focusedSearchIndex ? 'is-focused' : ''}" data-command-view="${item.view}">
          <span>${item.icon}</span>
          <span><b>${esc(item.title)}</b><small>${esc(item.desc)}</small></span>
          <small>打开 →</small>
        </button>`).join('')
      : `<div style="padding:28px;text-align:center;color:var(--muted);font-size:11px;">没有找到。换个词试试 🐾</div>`;
    qsa('[data-command-view]', commandResults).forEach(button => {
      button.addEventListener('click', () => { switchView(button.dataset.commandView); closeSearch(); });
    });
  }

  function moveSearchFocus(delta) {
    const results = filteredSearch(commandInput.value);
    if (!results.length) return;
    focusedSearchIndex = (focusedSearchIndex + delta + results.length) % results.length;
    renderSearch(commandInput.value);
    qs('.command-result.is-focused', commandResults)?.scrollIntoView({ block: 'nearest' });
  }

  function selectFocusedSearch() {
    const results = filteredSearch(commandInput.value);
    const item = results[focusedSearchIndex];
    if (!item) return;
    switchView(item.view);
    closeSearch();
  }

  function applyTheme(theme, remember = true) {
    const night = theme === 'night';
    document.body.classList.toggle('is-night', night);
    qs('#themeToggle').textContent = night ? '☀' : '☾';
    qs('#themeToggle').setAttribute('aria-label', night ? '切换日间' : '切换夜色');
    if (remember) localStorage.setItem('keatsHome.frontendTheme', theme);
  }

  function initTheme() {
    const saved = localStorage.getItem('keatsHome.frontendTheme');
    if (saved) return applyTheme(saved, false);
    const hour = new Date().getHours();
    applyTheme(hour >= 19 || hour < 6 ? 'night' : 'day', false);
  }

  function bindCardKeyboard() {
    qsa('[tabindex="0"][data-view]').forEach(card => {
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          switchView(card.dataset.view);
        }
      });
    });
  }

  function bindDynamicViewButtons() {
    qsa('[data-view]').forEach(button => {
      if (button.dataset.viewBound === '1') return;
      button.dataset.viewBound = '1';
      button.addEventListener('click', event => {
        if (event.target.closest('.compose')) return;
        switchView(button.dataset.view);
      });
    });
  }

  navButtons.forEach(button => {
    button.dataset.viewBound = '1';
    button.addEventListener('click', event => {
      if (event.target.closest('.compose')) return;
      switchView(button.dataset.view);
    });
  });

  qsa('.compose').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.kind)));
  qs('#newEntryButton').addEventListener('click', () => openEditor(kindByView[currentView] || '日记'));
  qs('#saveDraft').addEventListener('click', saveEntry);
  qsa('[data-close-modal]').forEach(button => button.addEventListener('click', closeEditor));
  editorModal.addEventListener('mousedown', event => { if (event.target === editorModal) closeEditor(); });

  if (syncPill) syncPill.addEventListener('click', () => openConnectionModal());

  qs('#searchTrigger').addEventListener('click', openSearch);
  searchModal.addEventListener('mousedown', event => { if (event.target === searchModal) closeSearch(); });
  commandInput.addEventListener('input', () => { focusedSearchIndex = 0; renderSearch(commandInput.value); });
  commandInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); moveSearchFocus(1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); moveSearchFocus(-1); }
    if (event.key === 'Enter') { event.preventDefault(); selectFocusedSearch(); }
  });

  qs('#mobileMenu').addEventListener('click', () => sidebar.classList.add('is-open'));
  qs('#mobileMore').addEventListener('click', () => sidebar.classList.add('is-open'));
  qs('#sidebarClose').addEventListener('click', () => sidebar.classList.remove('is-open'));

  qs('#themeToggle').addEventListener('click', () => applyTheme(document.body.classList.contains('is-night') ? 'day' : 'night'));

  qsa('.filter-row .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.textContent.trim() === '全部') {
        qsa('.filter-row .chip').forEach(item => item.classList.remove('is-selected'));
        chip.classList.add('is-selected');
      } else {
        qs('.filter-row .chip:first-child')?.classList.remove('is-selected');
        chip.classList.toggle('is-selected');
      }
    });
  });

  qsa('.editor-meta .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      qsa('.editor-meta .chip').forEach(item => item.classList.remove('is-selected'));
      chip.classList.add('is-selected');
    });
  });

  bindSongHearts();

  document.addEventListener('keydown', event => {
    const commandKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (commandKey) {
      event.preventDefault();
      searchModal.classList.contains('is-open') ? closeSearch() : openSearch();
      return;
    }
    if (event.key === 'Escape') {
      if (editorModal.classList.contains('is-open')) closeEditor();
      if (searchModal.classList.contains('is-open')) closeSearch();
      qs('#connectionModal')?.classList.remove('is-open');
      sidebar.classList.remove('is-open');
    }
  });

  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '');
    if (qs(`#view-${hash}`)) switchView(hash, { skipHash: true, instant: true });
  });

  async function boot() {
    setDate();
    initTheme();
    bindCardKeyboard();
    installConnectionModal();
    const initial = location.hash.replace('#', '');
    switchView(qs(`#view-${initial}`) ? initial : 'home', { skipHash: true, instant: true });
    const ready = await checkBackend();
    if (ready) await loadAllData();
  }

  boot();
})();