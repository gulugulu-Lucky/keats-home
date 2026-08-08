(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const state = { songs: [], selectedIndex: -1, spinning: false };
  const nodes = {
    pill: qs('#connectionPill'),
    unlockButton: qs('#unlockButton'),
    unlockModal: qs('#unlockModal'),
    unlockClose: qs('#unlockClose'),
    unlockSubmit: qs('#unlockSubmit'),
    keyInput: qs('#homeKeyInput'),
    error: qs('#unlockError'),
    recordList: qs('#recordList'),
    trackCount: qs('#trackCount'),
    nowState: qs('#nowState'),
    nowTitle: qs('#nowTitle'),
    nowArtist: qs('#nowArtist'),
    nowMoods: qs('#nowMoods'),
    nowReason: qs('#nowReason'),
    nowRecommender: qs('#nowRecommender'),
    spinButton: qs('#spinButton'),
    vinyl: qs('#vinyl'),
    liveDot: qs('#liveDot'),
    signalText: qs('#signalText'),
    signalDetail: qs('#signalDetail'),
    toast: qs('#toast')
  };

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setConnection(stateName, text) {
    nodes.pill.dataset.state = stateName;
    qs('span', nodes.pill).textContent = text;
    nodes.unlockButton.textContent = stateName === 'ready' ? '重新开门' : '开门';
  }

  function showToast(title, detail) {
    qs('b', nodes.toast).textContent = title;
    qs('small', nodes.toast).textContent = detail;
    nodes.toast.classList.remove('is-visible');
    void nodes.toast.offsetWidth;
    nodes.toast.classList.add('is-visible');
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
      if (response.status === 401) sessionStorage.removeItem(SESSION_KEY);
      throw Object.assign(new Error(data.error || data.message || '请求失败'), { status: response.status, data });
    }
    return data;
  }

  function openUnlock() {
    nodes.unlockModal.classList.add('is-open');
    nodes.unlockModal.setAttribute('aria-hidden', 'false');
    nodes.error.textContent = '';
    setTimeout(() => nodes.keyInput.focus(), 70);
  }

  function closeUnlock() {
    nodes.unlockModal.classList.remove('is-open');
    nodes.unlockModal.setAttribute('aria-hidden', 'true');
    nodes.keyInput.value = '';
    nodes.error.textContent = '';
  }

  function stopSpin() {
    state.spinning = false;
    nodes.vinyl.classList.remove('is-spinning');
    nodes.spinButton.classList.remove('is-spinning');
    nodes.spinButton.innerHTML = '<span>↻</span> 让唱片转起来';
  }

  function selectSong(index, options = {}) {
    const song = state.songs[index];
    if (!song) return;
    state.selectedIndex = index;
    if (!options.keepSpin) stopSpin();
    qsa('.record-row', nodes.recordList).forEach((row, rowIndex) => row.classList.toggle('is-selected', rowIndex === index));
    nodes.nowState.textContent = '等音源 · 已放到唱针下';
    nodes.nowTitle.textContent = song.title || '未命名歌曲';
    nodes.nowArtist.textContent = song.artist && song.artist !== '待补充' ? song.artist : '歌手还没写进去';
    nodes.nowMoods.innerHTML = (song.moods?.length ? song.moods : ['♪']).map(mood => `<span>${esc(mood)}</span>`).join('');
    nodes.nowReason.textContent = `“${song.reason || '这首歌已经被好好放进小家。'}”`;
    nodes.nowRecommender.textContent = `— ${song.recommender || '我们'} 推荐`;
    nodes.spinButton.disabled = false;
    nodes.liveDot.classList.add('is-live');
  }

  function renderSongs(items = []) {
    state.songs = items;
    nodes.trackCount.textContent = `${items.length} 张`;
    if (!items.length) {
      nodes.recordList.innerHTML = '<div class="empty-state"><span class="empty-disc">◉</span><b>唱片架还是空的。</b><small>等我们真正放进第一首歌。</small></div>';
      nodes.signalText.textContent = 'Notion 已接通 · 0 张唱片';
      nodes.signalDetail.textContent = '连接正常，只是歌单暂时还没有内容。';
      return;
    }

    nodes.recordList.innerHTML = items.map((song, index) => {
      const moodText = song.moods?.length ? song.moods.slice(0, 2).join(' · ') : '还没标氛围';
      const artist = song.artist && song.artist !== '待补充' ? song.artist : '歌手待补充';
      return `
        <button class="record-row" type="button" data-record-index="${index}">
          <span class="record-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="record-main"><b>${esc(song.title || '未命名歌曲')}</b><small>${esc(artist)}</small></span>
          <span class="record-person"><b>${esc(song.recommender || '我们')}</b><small>${esc(moodText)}</small></span>
          <span class="record-badge">等音源</span>
        </button>`;
    }).join('');

    qsa('[data-record-index]', nodes.recordList).forEach(button => {
      button.addEventListener('click', () => selectSong(Number(button.dataset.recordIndex)));
    });
    nodes.signalText.textContent = `Notion 已接通 · ${items.length} 张唱片`;
    nodes.signalDetail.textContent = '歌名、歌手、推荐人、氛围和推荐理由都来自我们的小家。';
    selectSong(0);
  }

  async function loadSongs() {
    setConnection('checking', '正在把唱片搬进来…');
    try {
      const data = await apiFetch('/api/songs?limit=50');
      renderSongs(data.items || []);
      setConnection('ready', 'Notion 已连接 · 电台在线');
      nodes.unlockButton.textContent = '换钥匙';
      return true;
    } catch (error) {
      if (error.status === 401) {
        setConnection('locked', '后端在线 · 等你开门');
        nodes.signalText.textContent = '等待接入 Notion';
        nodes.signalDetail.textContent = '只有通过小家钥匙验证后，网页才会读取歌名与推荐理由。';
        return false;
      }
      setConnection('error', '电台暂时没接稳');
      nodes.signalText.textContent = '信号断了一下';
      nodes.signalDetail.textContent = error.message || '稍后重新开门再试。';
      return false;
    }
  }

  async function checkBackend() {
    setConnection('checking', '正在摸门锁…');
    try {
      const health = await publicFetch('/health/notion');
      if (!health.notionReachable) throw new Error(health.message || 'Notion 暂时没接通');
      if (sessionStorage.getItem(SESSION_KEY)) {
        const loaded = await loadSongs();
        if (loaded) return;
      }
      setConnection('locked', '后端在线 · 等你开门');
    } catch (error) {
      setConnection('error', '后端还没接稳');
      nodes.signalText.textContent = '信号暂时中断';
      nodes.signalDetail.textContent = error.message || '小家后端现在没有回应。';
    }
  }

  async function unlock() {
    const key = nodes.keyInput.value;
    if (!key) {
      nodes.error.textContent = '钥匙还没填呀。';
      nodes.keyInput.focus();
      return;
    }
    nodes.unlockSubmit.disabled = true;
    nodes.unlockSubmit.textContent = '开门中…';
    nodes.error.textContent = '';
    try {
      const result = await publicFetch('/auth/login', { method: 'POST', body: JSON.stringify({ key }) });
      sessionStorage.setItem(SESSION_KEY, result.token);
      closeUnlock();
      showToast('电台门开啦', '正在从 Notion 搬唱片');
      await loadSongs();
    } catch (error) {
      nodes.error.textContent = error.status === 401 ? '这把钥匙不对，再想想。' : `开门失败：${error.message}`;
    } finally {
      nodes.unlockSubmit.disabled = false;
      nodes.unlockSubmit.textContent = '开门';
    }
  }

  nodes.spinButton.addEventListener('click', () => {
    if (state.selectedIndex < 0) return;
    state.spinning = !state.spinning;
    nodes.vinyl.classList.toggle('is-spinning', state.spinning);
    nodes.spinButton.classList.toggle('is-spinning', state.spinning);
    nodes.spinButton.innerHTML = state.spinning
      ? '<span>↻</span> 停下唱片'
      : '<span>↻</span> 让唱片转起来';
    if (state.spinning) showToast('唱片开始转了', '只是视觉唱盘；这首歌还没有接音源');
  });

  nodes.unlockButton.addEventListener('click', openUnlock);
  nodes.unlockClose.addEventListener('click', closeUnlock);
  nodes.unlockModal.addEventListener('mousedown', event => { if (event.target === nodes.unlockModal) closeUnlock(); });
  nodes.unlockSubmit.addEventListener('click', unlock);
  nodes.keyInput.addEventListener('keydown', event => { if (event.key === 'Enter') unlock(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeUnlock(); });

  checkBackend();
})();
