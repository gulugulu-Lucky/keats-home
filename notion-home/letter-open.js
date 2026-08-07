(() => {
  const qs = (selector, scope = document) => scope.querySelector(selector);
  let overlay = null;
  let navigating = false;

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="letter-opening" id="letterOpening" aria-hidden="true">
        <div class="letter-opening-scene" aria-label="正在拆信">
          <div class="letter-opening-envelope">
            <div class="letter-opening-paper">
              <span>TO MY LITTLE HOME</span>
              <b id="letterOpeningTitle">一封信</b>
              <i>🐈 · 🐆</i>
            </div>
            <div class="letter-opening-back"></div>
            <div class="letter-opening-left"></div>
            <div class="letter-opening-right"></div>
            <div class="letter-opening-front"></div>
            <div class="letter-opening-flap"></div>
            <div class="letter-opening-seal">K</div>
          </div>
          <small>信纸正在展开……</small>
        </div>
      </div>`);
    overlay = qs('#letterOpening');
    return overlay;
  }

  function openLetter(url, title = '一封信') {
    if (!url || navigating) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      window.location.href = url;
      return;
    }
    navigating = true;
    const box = ensureOverlay();
    qs('#letterOpeningTitle', box).innerHTML = esc(title || '一封信');
    box.classList.remove('is-opening');
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    void box.offsetWidth;
    requestAnimationFrame(() => box.classList.add('is-opening'));
    setTimeout(() => { window.location.href = url; }, 780);
  }

  document.addEventListener('click', event => {
    const letter = event.target.closest('#view-letters .mail-item[data-open-url]');
    if (!letter) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = letter.dataset.openUrl;
    if (!url) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const title = qs('h3', letter)?.textContent?.trim() || '一封信';
    openLetter(url, title);
  }, true);
})();