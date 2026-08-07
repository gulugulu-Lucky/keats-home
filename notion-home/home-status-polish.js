(() => {
  let scheduled = false;

  function polishHome() {
    const host = document.querySelector('.little-weather');
    const hero = document.querySelector('.hero-card');
    if (!host || !hero) return false;

    if (!host.classList.contains('home-status-feature')) {
      host.classList.add('home-status-feature');
    }
    if (host.previousElementSibling !== hero) {
      hero.insertAdjacentElement('afterend', host);
    }

    const lowerGrid = document.querySelector('.lower-grid');
    if (lowerGrid && !lowerGrid.classList.contains('is-status-detached')) {
      lowerGrid.classList.add('is-status-detached');
    }

    const eyebrow = host.querySelector('.section-heading .eyebrow');
    const title = host.querySelector('.section-heading h2');
    if (eyebrow && eyebrow.textContent !== 'CAT & PANTHER AT HOME') {
      eyebrow.textContent = 'CAT & PANTHER AT HOME';
    }
    if (title && title.textContent !== '猫豹在家') {
      title.textContent = '猫豹在家';
    }
    return true;
  }

  function polishReader() {
    const title = document.querySelector('.diary-state-title b');
    const detail = document.querySelector('.diary-state-title small');
    if (title && title.textContent !== '今日猫豹') title.textContent = '今日猫豹';
    if (detail && detail.textContent !== 'CAT & PANTHER NOTE') detail.textContent = 'CAT & PANTHER NOTE';
  }

  function polish() {
    scheduled = false;
    polishHome();
    polishReader();
  }

  function schedulePolish() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(polish);
  }

  const observer = new MutationObserver(schedulePolish);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('pageshow', schedulePolish);
  window.addEventListener('hashchange', schedulePolish);
  schedulePolish();
  setTimeout(schedulePolish, 500);
  setTimeout(schedulePolish, 1200);
  setTimeout(() => observer.disconnect(), 12000);
})();