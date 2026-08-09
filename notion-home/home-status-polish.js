(() => {
  let scheduled = false;
  let clockTimer = null;

  function renderLiveClock() {
    const today = document.querySelector('#todayText');
    const shortDate = document.querySelector('#shortDate');
    if (!today && !shortDate) return;

    const now = new Date();
    const dateText = new Intl.DateTimeFormat('zh-CN', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(now);
    const timeText = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).format(now);

    if (today) today.textContent = `${dateText} · ${timeText}`;
    if (shortDate) {
      shortDate.textContent = new Intl.DateTimeFormat('en-GB', {
        month: '2-digit',
        day: '2-digit'
      }).format(now).replace('/', ' / ');
    }
  }

  function startLiveClock() {
    renderLiveClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(renderLiveClock, 1000);
  }

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
    renderLiveClock();
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

  window.addEventListener('pageshow', () => {
    schedulePolish();
    renderLiveClock();
  });
  window.addEventListener('focus', renderLiveClock);
  window.addEventListener('hashchange', schedulePolish);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderLiveClock();
  });

  startLiveClock();
  schedulePolish();
  setTimeout(schedulePolish, 500);
  setTimeout(schedulePolish, 1200);
  setTimeout(() => observer.disconnect(), 12000);
})();