(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  let songs = [];
  let loading = false;
  let widget = null;
  let loadedUrl = '';
  let playing = false;
  let apiPromise = null;
  let widgetPromise = null;

  function isSoundCloud(song) {
    return Boolean(song && song.sourceType === 'SoundCloud' && /^https:\/\/soundcloud\.com\//i.test(song.sourceUrl || ''));
  }

  function selectedTitle() {
    return qs('.record-row.is-selected .record-main b')?.textContent?.trim()
      || qs('#nowTitle')?.textContent?.trim()
      || '';
  }

  function selectedSong() {
    const title = selectedTitle();
    return songs.find(song => String(song.title || '').trim() === title) || null;
  }

  async function loadSongs() {
    if (loading) return;
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;
    loading = true;
    try {
      const response = await fetch(`${API_BASE}/api/songs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        songs = data.items || [];
        decorateRows();
        syncSelectedSource();
      }
    } catch {}
    finally { loading = false; }
  }

  function decorateRows() {
    if (!songs.length) return;
    qsa('.record-row').forEach(row => {
      const title = qs('.record-main b', row)?.textContent?.trim() || '';
      const song = songs.find(item => String(item.title || '').trim() === title);
      if (!isSoundCloud(song)) return;
      const badge = qs('.record-badge', row);
      if (badge) badge.textContent = 'SoundCloud';
    });

    const sourced = songs.filter(song => song.sourceUrl && ['自托管音频', 'YouTube', 'Spotify', 'SoundCloud'].includes(String(song.sourceType || '').trim())).length;
    const detail = qs('#signalDetail');
    if (detail && sourced) detail.textContent = `其中 ${sourced} 张已经接上音源；播放按钮仍然归小家黑胶。`;
  }

  function ensureCredit(song) {
    const card = qs('#nowCard');
    if (!card) return;
    let credit = qs('#keatsSourceCredit', card);
    if (!credit) {
      credit = document.createElement('a');
      credit.id = 'keatsSourceCredit';
      credit.className = 'keats-source-credit';
      credit.target = '_blank';
      credit.rel = 'noopener noreferrer';
      qs('#nowReason', card)?.insertAdjacentElement('afterend', credit);
    }
    if (!isSoundCloud(song)) {
      credit.hidden = true;
      return;
    }
    credit.hidden = false;
    credit.href = song.sourceUrl;
    credit.innerHTML = '<span>◌</span> 官方音源 · Nettwerk Music Group on SoundCloud';
  }

  function ensureApi() {
    if (window.SC?.Widget) return Promise.resolve(window.SC);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      script.onload = () => window.SC?.Widget ? resolve(window.SC) : reject(new Error('SoundCloud API 没有准备好'));
      script.onerror = () => reject(new Error('SoundCloud API 没有加载成功'));
      document.head.appendChild(script);
    });
    return apiPromise;
  }

  function bindWidgetEvents(SC) {
    widget.bind(SC.Widget.Events.PLAY, () => setPlaying(true));
    widget.bind(SC.Widget.Events.PAUSE, () => setPlaying(false));
    widget.bind(SC.Widget.Events.FINISH, () => setPlaying(false));
    widget.bind(SC.Widget.Events.ERROR, () => {
      setPlaying(false);
      toast('SoundCloud 没有播起来', '官方音源暂时没有回应，再点一次试试');
    });
  }

  async function ensureWidget(song) {
    if (!isSoundCloud(song)) throw new Error('这张唱片没有 SoundCloud 音源');
    const SC = await ensureApi();

    if (!widget) {
      if (widgetPromise) return widgetPromise;
      widgetPromise = new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.id = 'keatsSoundCloudEngine';
        iframe.title = 'Keats Home SoundCloud audio engine';
        iframe.allow = 'autoplay';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(song.sourceUrl)}&auto_play=false&show_artwork=false&show_user=false&show_playcount=false&buying=false&sharing=false&download=false`;
        iframe.style.position = 'fixed';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.left = '-9999px';
        iframe.style.bottom = '0';
        iframe.style.opacity = '0.01';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);

        widget = SC.Widget(iframe);
        loadedUrl = song.sourceUrl;
        bindWidgetEvents(SC);
        let settled = false;
        const timer = setTimeout(() => { if (!settled) reject(new Error('SoundCloud 音源加载超时')); }, 8000);
        widget.bind(SC.Widget.Events.READY, () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(widget);
        });
      }).finally(() => { widgetPromise = null; });
      return widgetPromise;
    }

    if (loadedUrl !== song.sourceUrl) {
      loadedUrl = song.sourceUrl;
      await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => { if (!settled) reject(new Error('SoundCloud 音源加载超时')); }, 8000);
        widget.load(song.sourceUrl, {
          auto_play: false,
          show_artwork: false,
          show_user: false,
          show_playcount: false,
          buying: false,
          sharing: false,
          download: false,
          callback: () => {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    return widget;
  }

  function setPlaying(value) {
    playing = Boolean(value);
    const song = selectedSong();
    if (!isSoundCloud(song)) return;
    const vinyl = qs('#vinyl');
    const button = qs('#spinButton');
    vinyl?.classList.toggle('is-spinning', playing);
    button?.classList.toggle('is-spinning', playing);
    if (button) button.innerHTML = playing ? '<span>Ⅱ</span> 暂停' : '<span>▶</span> 播放';
    const state = qs('#nowState');
    if (state) state.textContent = playing ? '正在播放 · 小家唱机' : '可播放 · SoundCloud 官方音源';
  }

  function toast(title, detail) {
    const box = qs('#toast');
    if (!box) return;
    const b = qs('b', box);
    const small = qs('small', box);
    if (b) b.textContent = title;
    if (small) small.textContent = detail;
    box.classList.remove('is-visible');
    void box.offsetWidth;
    box.classList.add('is-visible');
  }

  async function toggleSoundCloud() {
    const song = selectedSong();
    if (!isSoundCloud(song)) return;
    const button = qs('#spinButton');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span>…</span> 唱针落下中';
    }
    try {
      const player = await ensureWidget(song);
      if (playing) player.pause();
      else player.play();
    } catch (error) {
      setPlaying(false);
      toast('唱针没落稳', error.message || '再点一次播放试试');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function syncSelectedSource() {
    const song = selectedSong();
    ensureCredit(song);
    if (!isSoundCloud(song)) return;
    const state = qs('#nowState');
    if (state && !playing) state.textContent = '可播放 · SoundCloud 官方音源';
    const button = qs('#spinButton');
    if (button && !playing) {
      button.disabled = false;
      button.classList.remove('is-spinning');
      button.innerHTML = '<span>▶</span> 播放';
    }
    ensureWidget(song).catch(() => {});
  }

  function handleCapture(event) {
    const button = event.target.closest?.('#spinButton');
    if (!button) return;
    const song = selectedSong();
    if (!isSoundCloud(song)) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (!event.isTrusted) {
      syncSelectedSource();
      return;
    }
    toggleSoundCloud();
  }

  function handleClick(event) {
    if (event.target.closest?.('.record-row')) {
      if (playing && widget) {
        try { widget.pause(); } catch {}
      }
      setTimeout(syncSelectedSource, 0);
      return;
    }
    if (event.target.closest?.('#djPickButton')) {
      setTimeout(() => {
        decorateRows();
        syncSelectedSource();
      }, 0);
    }
  }

  function boot() {
    document.addEventListener('click', handleCapture, true);
    document.addEventListener('click', handleClick, false);

    const list = qs('#recordList');
    if (list) {
      new MutationObserver(() => {
        decorateRows();
        syncSelectedSource();
        if (!songs.length) loadSongs();
      }).observe(list, { childList: true, subtree: true });
    }

    loadSongs();
    const timer = setInterval(() => {
      decorateRows();
      syncSelectedSource();
      if (!songs.length) loadSongs();
      if (songs.length && qsa('.record-row').length) clearInterval(timer);
    }, 500);
    setTimeout(() => clearInterval(timer), 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
