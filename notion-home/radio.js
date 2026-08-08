(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const state = { songs: [], selectedIndex: -1, spinning: false };
  const playback = {
    audio: new Audio(),
    audioUrl: '',
    ytPlayer: null,
    ytVideoId: '',
    ytApiPromise: null
  };

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
    vinylLabel: qs('.vinyl-label'),
    liveDot: qs('#liveDot'),
    signalText: qs('#signalText'),
    signalDetail: qs('#signalDetail'),
    toast: qs('#toast')
  };

  playback.audio.preload = 'metadata';

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

  function setSpinning(spinning) {
    state.spinning = Boolean(spinning);
    nodes.vinyl.classList.toggle('is-spinning', state.spinning);
    nodes.spinButton.classList.toggle('is-spinning', state.spinning);
  }

  function youtubeVideoId(value = '') {
    if (!value) return '';
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
      if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'm.youtube.com') {
        if (url.pathname === '/watch') return url.searchParams.get('v') || '';
        const parts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || '';
      }
    } catch {}
    return '';
  }

  function looksLikeAudioUrl(value = '') {
    return /^https?:\/\//i.test(value) && /\.(mp3|m4a|aac|ogg|oga|wav|flac)(?:[?#]|$)/i.test(value);
  }

  function sourceMeta(song = {}) {
    const type = String(song.sourceType || '').trim();
    const url = String(song.sourceUrl || '').trim();
    if (type === '自托管音频' && /^https?:\/\//i.test(url)) {
      return { kind: 'audio', badge: '自托管', state: '可播放 · 自托管音频', idleLabel: '▶ 播放' };
    }
    if (type === 'YouTube' && youtubeVideoId(url)) {
      return { kind: 'youtube', badge: 'YouTube', state: '可播放 · YouTube', idleLabel: '▶ 播放' };
    }
    if (type === 'Spotify' && /^https?:\/\//i.test(url)) {
      return { kind: 'spotify', badge: 'Spotify', state: '外部播放 · Spotify', idleLabel: '↗ 打开 Spotify' };
    }
    if (!type && looksLikeAudioUrl(url)) {
      return { kind: 'audio', badge: '音频', state: '可播放 · 直接音频', idleLabel: '▶ 播放' };
    }
    if (!type && youtubeVideoId(url)) {
      return { kind: 'youtube', badge: 'YouTube', state: '可播放 · YouTube', idleLabel: '▶ 播放' };
    }
    return { kind: 'visual', badge: '等音源', state: '等音源 · 已放到唱针下', idleLabel: '↻ 让唱片转起来' };
  }

  function setButtonLabel(song, playing = false) {
    const meta = sourceMeta(song);
    let text = meta.idleLabel;
    let symbol = '↻';
    if (meta.kind === 'audio' || meta.kind === 'youtube') {
      text = playing ? '暂停' : '播放';
      symbol = playing ? 'Ⅱ' : '▶';
    } else if (meta.kind === 'spotify') {
      text = '打开 Spotify';
      symbol = '↗';
    } else if (playing) {
      text = '停下唱片';
      symbol = '↻';
    }
    nodes.spinButton.innerHTML = `<span>${symbol}</span> ${text}`;
  }

  function setCover(song = {}) {
    const cover = String(song.coverUrl || '').trim();
    const b = qs('b', nodes.vinylLabel);
    const small = qs('small', nodes.vinylLabel);
    if (/^https?:\/\//i.test(cover)) {
      nodes.vinylLabel.style.backgroundImage = `url(${JSON.stringify(cover)})`;
      nodes.vinylLabel.style.backgroundSize = 'cover';
      nodes.vinylLabel.style.backgroundPosition = 'center';
      if (b) b.style.opacity = '0';
      if (small) small.style.opacity = '0';
      return;
    }
    nodes.vinylLabel.style.backgroundImage = '';
    nodes.vinylLabel.style.backgroundSize = '';
    nodes.vinylLabel.style.backgroundPosition = '';
    if (b) b.style.opacity = '';
    if (small) small.style.opacity = '';
  }

  function ensureYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (playback.ytApiPromise) return playback.ytApiPromise;
    playback.ytApiPromise = new Promise((resolve, reject) => {
      const prior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { if (typeof prior === 'function') prior(); } catch {}
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('YouTube 播放器没有加载成功'));
      document.head.appendChild(script);
      setTimeout(() => {
        if (window.YT?.Player) resolve(window.YT);
      }, 2500);
    });
    return playback.ytApiPromise;
  }

  async function ensureYouTubePlayer(videoId) {
    const YT = await ensureYouTubeApi();
    if (playback.ytPlayer && playback.ytVideoId === videoId) return playback.ytPlayer;
    if (playback.ytPlayer) {
      try { playback.ytPlayer.destroy(); } catch {}
      playback.ytPlayer = null;
    }
    qs('#keatsYoutubePlayer')?.remove();
    const host = document.createElement('div');
    host.id = 'keatsYoutubePlayer';
    host.style.position = 'fixed';
    host.style.width = '2px';
    host.style.height = '2px';
    host.style.left = '-9999px';
    host.style.bottom = '0';
    host.style.opacity = '0.01';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);

    playback.ytVideoId = videoId;
    playback.ytPlayer = await new Promise((resolve, reject) => {
      let settled = false;
      const player = new YT.Player(host, {
        width: '2',
        height: '2',
        videoId,
        playerVars: { playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => {
            settled = true;
            resolve(player);
          },
          onStateChange: event => {
            if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
              setSpinning(false);
              const song = state.songs[state.selectedIndex];
              if (song) setButtonLabel(song, false);
            }
            if (event.data === YT.PlayerState.PLAYING) {
              setSpinning(true);
              const song = state.songs[state.selectedIndex];
              if (song) setButtonLabel(song, true);
            }
          },
          onError: () => showToast('YouTube 没有播起来', '这首视频可能不允许嵌入播放')
        }
      });
      setTimeout(() => { if (!settled) reject(new Error('YouTube 播放器加载超时')); }, 8000);
    });
    return playback.ytPlayer;
  }

  function stopPlayback(options = {}) {
    try { playback.audio.pause(); } catch {}
    if (!options.keepAudioPosition) {
      try { playback.audio.currentTime = 0; } catch {}
    }
    if (playback.ytPlayer) {
      try { playback.ytPlayer.stopVideo(); } catch {}
    }
    setSpinning(false);
  }

  function selectSong(index) {
    const song = state.songs[index];
    if (!song) return;
    stopPlayback();
    state.selectedIndex = index;
    qsa('.record-row', nodes.recordList).forEach((row, rowIndex) => row.classList.toggle('is-selected', rowIndex === index));
    const meta = sourceMeta(song);
    nodes.nowState.textContent = meta.state;
    nodes.nowTitle.textContent = song.title || '未命名歌曲';
    nodes.nowArtist.textContent = song.artist && song.artist !== '待补充' ? song.artist : '歌手还没写进去';
    nodes.nowMoods.innerHTML = (song.moods?.length ? song.moods : ['♪']).map(mood => `<span>${esc(mood)}</span>`).join('');
    nodes.nowReason.textContent = `“${song.reason || '这首歌已经被好好放进小家。'}”`;
    nodes.nowRecommender.textContent = `— ${song.recommender || '我们'} 推荐`;
    nodes.spinButton.disabled = false;
    nodes.liveDot.classList.add('is-live');
    setButtonLabel(song, false);
    setCover(song);
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
      const source = sourceMeta(song);
      return `
        <button class="record-row" type="button" data-record-index="${index}">
          <span class="record-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="record-main"><b>${esc(song.title || '未命名歌曲')}</b><small>${esc(artist)}</small></span>
          <span class="record-person"><b>${esc(song.recommender || '我们')}</b><small>${esc(moodText)}</small></span>
          <span class="record-badge">${esc(source.badge)}</span>
        </button>`;
    }).join('');

    qsa('[data-record-index]', nodes.recordList).forEach(button => {
      button.addEventListener('click', () => selectSong(Number(button.dataset.recordIndex)));
    });
    const sourced = items.filter(item => sourceMeta(item).kind !== 'visual').length;
    nodes.signalText.textContent = `Notion 已接通 · ${items.length} 张唱片`;
    nodes.signalDetail.textContent = sourced
      ? `其中 ${sourced} 张已经接上音源；直接音频和 YouTube 可以从黑胶按钮播放。`
      : '歌单已经同步；给「音源类型 / 音源链接」填值以后，这里就会真的响起来。';
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

  async function toggleSelectedSong() {
    const song = state.songs[state.selectedIndex];
    if (!song) return;
    const meta = sourceMeta(song);

    if (meta.kind === 'visual') {
      const next = !state.spinning;
      setSpinning(next);
      setButtonLabel(song, next);
      if (next) showToast('唱片开始转了', '这张还没有音源，所以现在只转黑胶');
      return;
    }

    if (meta.kind === 'spotify') {
      window.open(song.sourceUrl, '_blank', 'noopener');
      showToast('把 Spotify 打开了', '以后再把它升级成小家里的内嵌播放');
      return;
    }

    if (meta.kind === 'audio') {
      if (playback.audioUrl !== song.sourceUrl) {
        playback.audio.pause();
        playback.audioUrl = song.sourceUrl;
        playback.audio.src = song.sourceUrl;
        playback.audio.currentTime = 0;
      }
      if (!playback.audio.paused) {
        playback.audio.pause();
        setSpinning(false);
        setButtonLabel(song, false);
        return;
      }
      try {
        await playback.audio.play();
        setSpinning(true);
        setButtonLabel(song, true);
        nodes.nowState.textContent = '正在播放 · 自托管音频';
      } catch (error) {
        setSpinning(false);
        setButtonLabel(song, false);
        showToast('音频没有播起来', '检查链接是否是浏览器可以直接访问的音频文件');
      }
      return;
    }

    if (meta.kind === 'youtube') {
      const videoId = youtubeVideoId(song.sourceUrl);
      try {
        const player = await ensureYouTubePlayer(videoId);
        const playerState = player.getPlayerState?.();
        if (playerState === window.YT?.PlayerState?.PLAYING) {
          player.pauseVideo();
          setSpinning(false);
          setButtonLabel(song, false);
          return;
        }
        player.playVideo();
        setSpinning(true);
        setButtonLabel(song, true);
        nodes.nowState.textContent = '正在播放 · YouTube';
      } catch (error) {
        setSpinning(false);
        setButtonLabel(song, false);
        showToast('YouTube 没有播起来', error.message || '再点一次播放试试');
      }
    }
  }

  playback.audio.addEventListener('ended', () => {
    const song = state.songs[state.selectedIndex];
    setSpinning(false);
    if (song) {
      setButtonLabel(song, false);
      nodes.nowState.textContent = sourceMeta(song).state;
    }
  });
  playback.audio.addEventListener('pause', () => {
    const song = state.songs[state.selectedIndex];
    if (!song || sourceMeta(song).kind !== 'audio') return;
    setSpinning(false);
    setButtonLabel(song, false);
  });

  nodes.spinButton.addEventListener('click', toggleSelectedSong);
  nodes.unlockButton.addEventListener('click', openUnlock);
  nodes.unlockClose.addEventListener('click', closeUnlock);
  nodes.unlockModal.addEventListener('mousedown', event => { if (event.target === nodes.unlockModal) closeUnlock(); });
  nodes.unlockSubmit.addEventListener('click', unlock);
  nodes.keyInput.addEventListener('keydown', event => { if (event.key === 'Enter') unlock(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeUnlock(); });
  window.addEventListener('beforeunload', () => stopPlayback());

  checkBackend();
})();
