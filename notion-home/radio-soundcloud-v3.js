(() => {
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  let songs = [];
  let widget = null;
  let widgetUrl = '';
  let widgetReadyPromise = null;
  let apiPromise = null;
  let playing = false;

  function isSoundCloud(song) {
    if (!song) return false;
    const type = String(song.sourceType || '').trim();
    const url = String(song.sourceUrl || '').trim();
    return type === 'SoundCloud' && /^https:\/\/(?:www\.)?(?:soundcloud\.com|on\.soundcloud\.com)\//i.test(url);
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
    credit.innerHTML = '<span>◌</span> 官方音源 · SoundCloud';
  }

  function decorate() {
    if (!songs.length) return;

    qsa('.record-row').forEach(row => {
      const title = qs('.record-main b', row)?.textContent?.trim() || '';
      const song = songs.find(item => String(item.title || '').trim() === title);
      if (!isSoundCloud(song)) return;
      const badge = qs('.record-badge', row);
      if (badge && badge.textContent.trim() !== 'SoundCloud') badge.textContent = 'SoundCloud';
    });

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

    const detail = qs('#signalDetail');
    const connected = songs.filter(song => song.sourceUrl && String(song.sourceType || '').trim()).length;
    if (detail && connected) detail.textContent = `其中 ${connected} 张已经接上音源；播放按钮归小家唱机。`;
  }

  function scheduleDecorate() {
    let tries = 0;
    const tick = () => {
      tries += 1;
      decorate();
      if (qsa('.record-row').length || tries >= 24) return;
      setTimeout(tick, 100);
    };
    requestAnimationFrame(tick);
  }

  function captureSongsFromResponse(response) {
    try {
      response.clone().json().then(data => {
        if (!Array.isArray(data?.items)) return;
        songs = data.items;
        window.__keatsRadioSongs = songs;
        scheduleDecorate();
        document.dispatchEvent(new CustomEvent('keats:radio-songs', { detail: { count: songs.length } }));
      }).catch(() => {});
    } catch {}
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const target = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (/\/api\/songs(?:\?|$)/.test(target) && response.ok) captureSongsFromResponse(response);
    return response;
  };

  function ensureSoundCloudApi() {
    if (window.SC?.Widget) return Promise.resolve(window.SC);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-keats-sc-api]');
      if (existing) {
        const started = Date.now();
        const wait = setInterval(() => {
          if (window.SC?.Widget) {
            clearInterval(wait);
            resolve(window.SC);
          } else if (Date.now() - started > 7000) {
            clearInterval(wait);
            reject(new Error('SoundCloud API 没准备好'));
          }
        }, 80);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      script.dataset.keatsScApi = '1';
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
      host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:.001;z-index:-1';
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
        iframe.style.cssText = 'width:1px;height:1px;border:0;display:block';
        iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(song.sourceUrl)}&auto_play=false&show_artwork=false&show_user=false&show_playcount=false&buying=false&sharing=false&download=false`;
        engineHost().appendChild(iframe);

        widget = SC.Widget(iframe);
        widgetUrl = song.sourceUrl;
        widget.bind(SC.Widget.Events.PLAY, () => setPlaying(true));
        widget.bind(SC.Widget.Events.PAUSE, () => setPlaying(false));
        widget.bind(SC.Widget.Events.FINISH, () => setPlaying(false));
        widget.bind(SC.Widget.Events.ERROR, () => {
          setPlaying(false);
          toast('唱机没有响', 'SoundCloud 官方音源暂时没有回应');
        });

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) reject(new Error('SoundCloud 音源加载超时'));
        }, 9000);
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
        }, 9000);
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

  function captureClick(event) {
    const button = event.target.closest?.('#spinButton');
    if (!button) return;
    const song = selectedSong();
    if (!isSoundCloud(song)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    toggleSoundCloud();
  }

  function bubbleClick(event) {
    if (event.target.closest?.('.record-row')) {
      if (playing && widget) {
        try { widget.pause(); } catch {}
      }
      setTimeout(decorate, 0);
      return;
    }

    if (event.target.closest?.('#djPickButton')) {
      setTimeout(decorate, 0);
    }
  }

  document.addEventListener('click', captureClick, true);
  document.addEventListener('click', bubbleClick, false);
  document.addEventListener('keats:radio-songs', scheduleDecorate);

  if (Array.isArray(window.__keatsRadioSongs)) {
    songs = window.__keatsRadioSongs;
    scheduleDecorate();
  }
})();
