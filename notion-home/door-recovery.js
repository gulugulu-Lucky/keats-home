(() => {
  const SESSION_KEY = 'keatsHome.sessionToken';
  const qs = (s, root = document) => root.querySelector(s);

  function openRealDoor() {
    const pill = qs('.sync-pill');
    if (!pill) return false;
    pill.click();
    return true;
  }

  function closeReturnHomeDrawer() {
    const drawer = qs('#returnHomeDrawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function installRecoveryButton() {
    const drawer = qs('#returnHomeDrawer');
    if (!drawer || !drawer.classList.contains('is-open')) return;
    const title = qs('#returnHomeTitle', drawer);
    const note = qs('.return-home-note', drawer);
    if (!title || !note) return;
    if (!/门还在|重新开/.test(title.textContent || '')) return;
    if (qs('.door-recovery-button', note)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary-button door-recovery-button';
    button.textContent = '🔑 重新开门';
    button.style.cssText = 'margin-top:18px;min-height:44px;padding:10px 20px;border-radius:18px;position:relative;z-index:2;';
    const footer = qs('footer', note);
    note.insertBefore(button, footer || null);
    button.addEventListener('click', () => {
      closeReturnHomeDrawer();
      setTimeout(openRealDoor, 30);
    });
  }

  function guardPresenceClick(event) {
    const presence = event.target.closest?.('.hero-presence');
    if (!presence) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!openRealDoor()) {
      setTimeout(openRealDoor, 120);
    }
  }

  document.addEventListener('click', guardPresenceClick, true);

  const observer = new MutationObserver(() => {
    installRecoveryButton();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'aria-hidden']
  });

  window.addEventListener('pageshow', installRecoveryButton);
  setTimeout(installRecoveryButton, 500);
})();
