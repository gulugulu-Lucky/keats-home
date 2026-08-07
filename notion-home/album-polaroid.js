(() => {
  const STORAGE_KEY = 'keatsHome.albumView';
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function savedMode() {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'desk' ? 'desk' : 'grid';
  }

  function applyMode(cabinet, mode, remember = true) {
    const next = mode === 'desk' ? 'desk' : 'grid';
    cabinet.dataset.albumView = next;
    cabinet.classList.toggle('album-view-desk', next === 'desk');
    cabinet.classList.toggle('album-view-grid', next === 'grid');

    qsa('[data-album-view-mode]', cabinet).forEach(button => {
      const active = button.dataset.albumViewMode === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const hint = qs('.album-view-hint', cabinet);
    if (hint) {
      hint.textContent = next === 'desk'
        ? '照片摊在桌上了。纸角、胶带和一点点歪都故意留着。'
        : '整整齐齐收好，适合慢慢翻抽屉。';
    }

    if (remember) localStorage.setItem(STORAGE_KEY, next);
  }

  function ensureControls() {
    const cabinet = qs('#view-album .album-cabinet');
    if (!cabinet) return false;
    if (qs('.album-view-toolbar', cabinet)) {
      applyMode(cabinet, cabinet.dataset.albumView || savedMode(), false);
      return true;
    }

    const kicker = qs('.hidden-room-kicker', cabinet);
    const toolbar = document.createElement('div');
    toolbar.className = 'album-view-toolbar';
    toolbar.innerHTML = `
      <div class="album-view-copy">
        <small>HOW TO LEAVE THE PHOTOS</small>
        <b>照片今天怎么摆？</b>
        <span class="album-view-hint">整整齐齐收好，适合慢慢翻抽屉。</span>
      </div>
      <div class="album-view-switch" role="group" aria-label="相册展示方式">
        <button type="button" data-album-view-mode="grid" aria-pressed="false"><span>▦</span> 整齐相册</button>
        <button type="button" data-album-view-mode="desk" aria-pressed="false"><span>◫</span> 桌上拍立得</button>
      </div>`;

    if (kicker) kicker.insertAdjacentElement('afterend', toolbar);
    else cabinet.prepend(toolbar);

    qsa('[data-album-view-mode]', toolbar).forEach(button => {
      button.addEventListener('click', () => applyMode(cabinet, button.dataset.albumViewMode));
    });

    applyMode(cabinet, savedMode(), false);
    return true;
  }

  function boot() {
    ensureControls();
    setTimeout(ensureControls, 250);
    setTimeout(ensureControls, 800);
    setTimeout(ensureControls, 1600);
  }

  window.addEventListener('pageshow', boot);
  window.addEventListener('hashchange', boot);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-view="album"]')) setTimeout(boot, 180);
  });

  const albumView = qs('#view-album');
  if (albumView) {
    const observer = new MutationObserver(() => {
      if (!qs('.album-view-toolbar', albumView) && qs('.album-cabinet', albumView)) {
        queueMicrotask(ensureControls);
      }
    });
    observer.observe(albumView, { childList: true, subtree: true });
  }

  boot();
})();