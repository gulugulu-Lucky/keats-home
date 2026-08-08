(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const qs = (selector, scope = document) => scope.querySelector(selector);

  let songs = [];
  let loadingSongs = false;

  function youtubeId(value = '') {
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

  function isYoutubeSong(song) {
    return Boolean(song && youtubeId(song.sourceUrl || '') && (!song.sourceType || song.sourceType === 'YouTube'));
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

  function selectedTitle() {
    return qs('.record-row.is-selected .record-main b')?.textContent?.trim() || qs('#nowTitle')?.textContent?.trim() || '';
  }

  function selectedSong() {
    const title = selectedTitle();
    return songs.find(song => (song.title || '').trim() === title) || null;
  }

  function removeStage({ resetButton = true } = {}) {
    qs('#keatsYoutubeStage')?.remove();
    qs('#vinyl')?.classList.remove('is-spinning');
    const button = qs('#spinButton');
    if (button && resetButton && qs('.record-row.is-selected .record-badge')?.textContent?.trim() === 'YouTube') {
      button.classList.remove('is-spinning');
      button.innerHTML = '<span>▶</span> 播放';
    }
  }

  function showStage(song, autoplay = true) {
    const id = youtubeId(song?.sourceUrl || '');
    if (!id) return false;
    removeStage({ resetButton: false });

    const nowCard = qs('#nowCard');
    const footer = qs('.now-footer', nowCard || document);
    if (!nowCard || !footer) return false;

    const stage = document.createElement('div');
    stage.id = 'keatsYoutubeStage';
    stage.className = 'keats-youtube-stage';
    stage.innerHTML = `
      <div class="keats-youtube-stage-head"><span>YOUTUBE · NOW PLAYING</span><button type="button" aria-label="收起 YouTube 播放器">×</button></div>
      <div class="keats-youtube-frame"><iframe title="${String(song.title || 'YouTube').replace(/"/g, '&quot;')}" src="https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=${autoplay ? '1' : '0'}&playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
      <small>如果系统拦住自动播放，直接点播放器里的 ▶ 就可以。豹豹不再偷偷藏一个 2px 播放器了。</small>`;
    footer.insertAdjacentElement('beforebegin', stage);
    qs('button', stage)?.addEventListener('click', () => removeStage());

    qs('#vinyl')?.classList.add('is-spinning');
    const button = qs('#spinButton');
    if (button) {
      button.classList.add('is-spinning');
      button.innerHTML = '<span>⌃</span> 收起 YouTube';
    }
    const state = qs('#nowState');
    if (state) state.textContent = '正在播放 · YouTube';
    return true;
  }

  function selectedBadge() {
    return qs('.record-row.is-selected .record-badge')?.textContent?.trim() || '';
  }

  function showAfterLoad(autoplay = false) {
    loadSongs().then(() => {
      const song = selectedSong();
      if (isYoutubeSong(song) && !qs('#keatsYoutubeStage')) showStage(song, autoplay);
    });
  }

  function handleSpinCapture(event) {
    const button = event.target.closest?.('#spinButton');
    if (!button || selectedBadge() !== 'YouTube') return;

    // Never let the old hidden 2px YouTube player take over on mobile/in-app browsers.
    event.preventDefault();
    event.stopImmediatePropagation();

    const current = qs('#keatsYoutubeStage');
    if (current) {
      if (event.isTrusted) removeStage();
      return;
    }

    // A synthetic click from DJ Keats is intentionally swallowed here.
    // The original trusted DJ-button tap will create the visible player below.
    if (!event.isTrusted) return;

    const song = selectedSong();
    if (isYoutubeSong(song)) showStage(song, true);
    else showAfterLoad(false);
  }

  function shanghaiHour() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false
      }).formatToParts(new Date());
      return Number(parts.find(part => part.type === 'hour')?.value || 12);
    } catch { return new Date().getHours(); }
  }

  function timeCopy() {
    const hour = shanghaiHour();
    if (hour >= 5 && hour < 11) return { heading: '早上让我选。', pick: "DJ'S PICK · MORNING" };
    if (hour >= 11 && hour < 18) return { heading: '下午让我选。', pick: "DJ'S PICK · AFTERNOON" };
    if (hour >= 18 && hour < 22) return { heading: '今晚让我选。', pick: "DJ'S PICK · EVENING" };
    return { heading: '夜里让我选。', pick: "DJ'S PICK · LATE NIGHT" };
  }

  function refreshDjCopy() {
    const card = qs('#djKeatsCard');
    if (!card) return;
    const copy = timeCopy();
    const heading = qs('.dj-keats-head h3', card);
    const pick = qs('.dj-keats-pick small', card);
    const foot = qs('#djKeatsFoot', card);
    if (heading && heading.textContent !== copy.heading) heading.textContent = copy.heading;
    if (pick && pick.textContent !== copy.pick) pick.textContent = copy.pick;
    if (foot?.textContent?.startsWith('今晚已经点过')) foot.textContent = foot.textContent.replace('今晚已经点过', '今天已经点过');
  }

  function handleDocumentClick(event) {
    if (event.target.closest?.('.record-row')) {
      removeStage({ resetButton: false });
      setTimeout(loadSongs, 0);
      return;
    }

    if (event.target.closest?.('#djPickButton')) {
      // Target listener in radio-dj.js has already selected the record; this is
      // still the same real finger tap, so the iframe is born from user intent.
      refreshDjCopy();
      const song = selectedSong();
      if (isYoutubeSong(song)) showStage(song, true);
      else if (selectedBadge() === 'YouTube') showAfterLoad(false);
    }
  }

  function boot() {
    document.addEventListener('click', handleSpinCapture, true);
    document.addEventListener('click', handleDocumentClick, false);

    const observer = new MutationObserver(() => {
      refreshDjCopy();
      if (!songs.length) loadSongs();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    refreshDjCopy();
    loadSongs();
    const timer = setInterval(() => {
      refreshDjCopy();
      if (!songs.length) loadSongs();
      else clearInterval(timer);
    }, 600);
    setTimeout(() => clearInterval(timer), 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
