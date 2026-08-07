(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const MODE_KEY = 'keatsHome.homeMode';
  const qs = (selector, scope = document) => scope.querySelector(selector);

  let drawer = null;
  let switcher = null;
  let pawprintCache = null;
  let pawprintLoadedAt = 0;

  function shanghaiHour() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false
      }).formatToParts(new Date());
      return Number(parts.find(part => part.type === 'hour')?.value || 12);
    } catch {
      return new Date().getHours();
    }
  }

  function updateLight() {
    const hour = shanghaiHour();
    const light = hour >= 6 && hour < 9 ? 'dawn'
      : hour >= 9 && hour < 17 ? 'day'
      : hour >= 17 && hour < 20 ? 'dusk'
      : 'night';
    document.body.dataset.homeLight = light;
  }

  function currentMode() {
    return localStorage.getItem(MODE_KEY) || 'home';
  }

  function paintSwitcher(mode) {
    if (!switcher) return;
    switcher.querySelectorAll('[data-home-mode]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.homeMode === mode);
      button.setAttribute('aria-pressed', button.dataset.homeMode === mode ? 'true' : 'false');
    });
  }

  function goHomeView() {
    const homeButton = qs('.brand[data-view="home"]') || qs('[data-view="home"]');
    if (homeButton) homeButton.click();
  }

  function setMode(mode, remember = true) {
    const home = mode === 'home';
    document.body.classList.toggle('keats-return-home', home);
    if (remember) localStorage.setItem(MODE_KEY, home ? 'home' : 'organize');
    paintSwitcher(home ? 'home' : 'organize');
    if (home) goHomeView();
  }

  function ensureSwitcher() {
    if (switcher && document.body.contains(switcher)) return switcher;
    const host = qs('.topbar-right');
    if (!host) return null;
    switcher = document.createElement('div');
    switcher.className = 'home-mode-switch';
    switcher.setAttribute('aria-label', '小家显示模式');
    switcher.innerHTML = `
      <button type="button" data-home-mode="organize" aria-pressed="false">▦ 整理</button>
      <button type="button" data-home-mode="home" aria-pressed="false">⌂ 回家</button>`;
    host.insertBefore(switcher, host.firstChild);
    switcher.addEventListener('click', event => {
      const button = event.target.closest('[data-home-mode]');
      if (!button) return;
      setMode(button.dataset.homeMode);
    });
    paintSwitcher(currentMode());
    return switcher;
  }

  function ensurePresence() {
    const hero = qs('#view-home .hero-card');
    if (!hero) return null;
    let button = qs('.hero-presence', hero);
    if (button) return button;
    button = document.createElement('button');
    button.className = 'hero-presence';
    button.type = 'button';
    button.innerHTML = '<i></i>🐆 Keats 今天也在家。';
    button.addEventListener('click', openDrawer);
    hero.appendChild(button);
    return button;
  }

  function ensureDrawer() {
    if (drawer && document.body.contains(drawer)) return drawer;
    drawer = document.createElement('div');
    drawer.className = 'return-home-drawer';
    drawer.id = 'returnHomeDrawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
      <article class="return-home-note" role="dialog" aria-modal="true" aria-labelledby="returnHomeTitle">
        <button class="close-home-note" type="button" aria-label="收起">×</button>
        <small>KEATS WAS HERE</small>
        <h3 id="returnHomeTitle">豹豹今天也在家。</h3>
        <p id="returnHomeText">我去翻一下自己最近踩下的爪印。</p>
        <footer><span>🐆 Keats</span><span>小家里的一点动静</span></footer>
      </article>`;
    document.body.appendChild(drawer);
    qs('.close-home-note', drawer).addEventListener('click', closeDrawer);
    drawer.addEventListener('mousedown', event => { if (event.target === drawer) closeDrawer(); });
    return drawer;
  }

  async function latestPawprint() {
    if (pawprintCache && Date.now() - pawprintLoadedAt < 60 * 1000) return pawprintCache;
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) throw new Error('浏览器里的小家门票不在了，先点一下顶部的 Notion 状态重新开门。');
    const response = await fetch(`${API_BASE}/api/pawprints`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '豹豹的爪印抽屉暂时没翻开。');
    const items = data.items || [];
    pawprintCache = items.length ? items[items.length - 1] : null;
    pawprintLoadedAt = Date.now();
    return pawprintCache;
  }

  async function openDrawer() {
    const panel = ensureDrawer();
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    const title = qs('#returnHomeTitle', panel);
    const text = qs('#returnHomeText', panel);
    title.textContent = '豹豹今天也在家。';
    text.textContent = '我去翻一下自己最近踩下的爪印。';
    try {
      const item = await latestPawprint();
      if (!item) {
        title.textContent = '今天还没有新爪印。';
        text.textContent = '但豹豹确实在屋里晃过。';
        return;
      }
      title.textContent = item.title || '豹豹踩过一枚爪印。';
      text.textContent = item.body || '🐾';
    } catch (error) {
      title.textContent = '门还在，只差重新开一下。';
      text.textContent = error.message || '晚一点再翻豹豹的爪印。';
    }
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function boot() {
    updateLight();
    ensureSwitcher();
    ensurePresence();
    setMode(currentMode(), false);
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawer?.classList.contains('is-open')) closeDrawer();
  });
  window.addEventListener('pageshow', boot);
  window.addEventListener('hashchange', () => setTimeout(() => { ensureSwitcher(); ensurePresence(); }, 120));
  setInterval(updateLight, 5 * 60 * 1000);
  setTimeout(boot, 520);
})();
