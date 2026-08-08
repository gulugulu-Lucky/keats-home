(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  let songs = [];
  let loadingSongs = false;
  let widget = null;
  let widgetUrl = '';
  let widgetReadyPromise = null;
  let playing = false;
  let apiPromise = null;

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

  async function loadSongs() {
    if (loadingSongs || songs.length) return;
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;
    loadingSongs = true;
    try {
      const response = await fetch(`${API_BASE}/api/songs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) songs = data.items || [];
    } catch {}
    finally { loadingSongs = false; }
  }

  function decorateRows() {
    if (!songs.length) return;
    qsa('.record-row').forEach(row => {
      const title = qs('.record-main b', row)?.textContent?.trim() || '';
      const song = songs.find(item => String(item.title || '').trim() === title);
      if (!isSoundCloud(song)) return;
      const badge = qs('.record-badge', row);
      if (badge && badge.textContent.trim() !== 'SoundCloud') badge.textContent = 'SoundCloud';
    });
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

  function setPlaying(value) {
    playing = Boolean(value);
    const song = selectedSong();
    if (!isSoundCloud(song)) return;
    qs('#vinyl')?.classList.toggle('is-spinning', playing);
    const button = qs('#spinButton');
    button?.classList.toggle('is-spinning', playing);
    if (button) button.innerHTML = playing ? '<span>Ⅱ</span> 暂停' : '<span>▶</span> 播放';
    const state = qs('#nowState');
    if (state) state.textContent = playing ? '正在播放 · 小家唱机' : '可播放 · SoundCloud 官方音源';
  }

  function syncSelected() {
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
  }

  function ensureSoundCloudApi() {
    if (window.SC?.Widget) return Promise.resolve(window.SC);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      script.onload = () => window.SC?.Widget ? resolve(window.SC) : reject(new Error('SoundCloud API 没准备好'));
      script.onerror = () => reject(new Error('SoundCloud API 没加载成功'));
      document.head.appendChild(script);
    });
    return apiPromise;
  }

  function engineHost() {
    let host = qs('#keatsAudioEngineHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'keatsAudioEngineHost';
      host.setAttribute('aria-hidden', 'true');
      document.body.appendChild(host);
    }
    return host;
  }

  async function ensureWidget(song) {
    if (!isSoundCloud(song)) throw new Error('这张唱片没有 SoundCloud 音源');
    const SC = await ensureSoundCloudApi();

    if (!widget) {
      if (widgetReadyPromise) return widgetReadyPromise;
      widgetReadyPromise = new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.id = 'keatsSoundCloudEngine';
        iframe.width = '1';
        iframe.height = '1';
        iframe.allow = 'autoplay';
        iframe.tabIndex = -1;
        iframe.title = 'Keats Home audio engine';
        iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(song.sourceUrl)}&auto_play=false&show_artwork=false&show_user=false&show_playcount=false&buying=false&sharing=false&download=false`;
        engineHost().appendChild(iframe);

        widget = SC.Widget(iframe);
        widgetUrl = song.sourceUrl;
        widget.bind(SC.Widget.Events.PLAY, () => setPlaying(true));
        widget.bind(SC.Widget.Events.PAUSE, () => setPlaying(false));
        widget.bind(SC.Widget.Events.FINISH, () => setPlaying(false));
        widget.bind(SC.Widget.Events.ERROR, () => {
          setPlaying(false);
          toast('唱机没有响', '官方音源暂时没有回应，再点一次试试');
        });

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) reject(new Error('SoundCloud 音源加载超时'));
        }, 8000);
        widget.bind(SC.Widget.Events.READY, () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(widget);
        });
      }).finally(() => { widgetReadyPromise = null; });
      return widgetReadyPromise;
    }

    if (widgetUrl !== song.sourceUrl) {
      widgetUrl = song.sourceUrl;
      await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) reject(new Error('SoundCloud 音源加载超时'));
        }, 8000);
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

  async function toggleSoundCloud({ forcePlay = false } = {}) {
    const song = selectedSong();
    if (!isSoundCloud(song)) return;
    const button = qs('#spinButton');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span>…</span> 唱针落下中';
    }
    try {
      const player = await ensureWidget(song);
      if (playing && !forcePlay) player.pause();
      else player.play();
    } catch (error) {
      setPlaying(false);
      toast('唱针没落稳', error.message || '再点一次播放试试');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function handleCapture(event) {
    const button = event.target.closest?.('#spinButton');
    if (!button) return;
    const song = selectedSong();
    if (!isSoundCloud(song)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    // DJ Keats creates a synthetic click on the old playback button. Ignore it;
    // the real DJ tap is handled below while iOS still grants user activation.
    if (!event.isTrusted) {
      syncSelected();
      return;
    }
    toggleSoundCloud();
  }

  function handleBubble(event) {
    if (event.target.closest?.('.record-row')) {
      if (playing && widget) {
        try { widget.pause(); } catch {}
      }
      setTimeout(syncSelected, 0);
      return;
    }

    if (event.target.closest?.('#djPickButton') && event.isTrusted) {
      setTimeout(() => {
        decorateRows();
        syncSelected();
      }, 0);
      const song = selectedSong();
      if (isSoundCloud(song)) toggleSoundCloud({ forcePlay: true });
    }
  }

  async function refresh() {
    await loadSongs();
    decorateRows();
    syncSelected();
  }

  function boot() {
    document.addEventListener('click', handleCapture, true);
    document.addEventListener('click', handleBubble, false);
    refresh();

    // Short bounded poll only for the initial authenticated render. No DOM observer,
    // no permanent timer, and no audio iframe until the user actually presses play.
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      await refresh();
      if ((songs.length && qsa('.record-row').length) || tries >= 20) clearInterval(timer);
    }, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
