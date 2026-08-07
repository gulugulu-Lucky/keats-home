(() => {
  function polishHome() {
    const host = document.querySelector('.little-weather');
    const hero = document.querySelector('.hero-card');
    if (!host || !hero) return;

    host.classList.add('home-status-feature');
    if (host.previousElementSibling !== hero) {
      hero.insertAdjacentElement('afterend', host);
    }

    const lowerGrid = document.querySelector('.lower-grid');
    if (lowerGrid) lowerGrid.classList.add('is-status-detached');

    const eyebrow = host.querySelector('.section-heading .eyebrow');
    const title = host.querySelector('.section-heading h2');
    if (eyebrow) eyebrow.textContent = 'CAT & PANTHER AT HOME';
    if (title) title.textContent = '猫豹在家';
  }

  function polishReader() {
    const title = document.querySelector('.diary-state-title b');
    const detail = document.querySelector('.diary-state-title small');
    if (title) title.textContent = '今日猫豹';
    if (detail) detail.textContent = 'CAT & PANTHER NOTE';
  }

  function polish() {
    polishHome();
    polishReader();
  }

  const observer = new MutationObserver(polish);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pageshow', polish);
  window.addEventListener('hashchange', polish);
  setTimeout(polish, 250);
  setTimeout(polish, 900);
  setTimeout(() => observer.disconnect(), 20000);
})();