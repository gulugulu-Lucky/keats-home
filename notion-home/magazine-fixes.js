(() => {
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function syncRoomClass() {
    const active = location.hash === '#magazine' || qs('#view-magazine.is-visible');
    document.body.classList.toggle('magazine-room-active', Boolean(active));
  }

  function removeBrokenFigure(img) {
    const figure = img.closest('.magazine-photo-strip figure');
    const strip = img.closest('.magazine-photo-strip');
    if (figure) figure.remove();
    if (strip && !qs('figure', strip)) strip.remove();
  }

  function repairInsertPhotos() {
    const images = qsa('#magazineBook .magazine-photo-strip img');
    if (!images.length) return false;
    images.forEach(img => {
      if (img.dataset.magazineImageBound === '1') return;
      img.dataset.magazineImageBound = '1';
      img.addEventListener('error', () => removeBrokenFigure(img), { once: true });
      if (img.complete && img.naturalWidth === 0) removeBrokenFigure(img);
    });
    return true;
  }

  function settle() {
    syncRoomClass();
    requestAnimationFrame(() => requestAnimationFrame(repairInsertPhotos));
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-view="magazine"], [data-magazine-month]')) {
      setTimeout(settle, 90);
      setTimeout(repairInsertPhotos, 700);
    }
  }, true);

  window.addEventListener('hashchange', settle);
  window.addEventListener('pageshow', settle);
  settle();

  let tries = 0;
  const waiter = setInterval(() => {
    tries += 1;
    syncRoomClass();
    if (repairInsertPhotos() || tries >= 24) clearInterval(waiter);
  }, 500);
})();