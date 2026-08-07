(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const MAX_BYTES = 5 * 1024 * 1024;
  const SECTIONS = ['Keats的照片', '小猫的照片', '形象图 / 捏人 / 画像', '专属区', '表情包收藏'];
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function currentSection() {
    const active = qs('#view-album .album-tab.is-active');
    const title = active?.textContent?.trim();
    return SECTIONS.includes(title) ? title : 'Keats的照片';
  }

  function ensureModal() {
    if (qs('#albumUploadModal')) return qs('#albumUploadModal');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="album-upload-backdrop" id="albumUploadModal" aria-hidden="true">
        <section class="album-upload-modal" role="dialog" aria-modal="true" aria-labelledby="albumUploadTitle">
          <header>
            <div><small>PUT IT IN OUR ALBUM</small><h2 id="albumUploadTitle">放一张照片回家</h2></div>
            <button class="album-upload-close" type="button" aria-label="关闭">×</button>
          </header>

          <label class="album-upload-field">
            <span>放进哪个抽屉</span>
            <select id="albumUploadSection">${SECTIONS.map(section => `<option value="${esc(section)}">${esc(section)}</option>`).join('')}</select>
          </label>

          <label class="album-file-picker" for="albumFileInput">
            <input id="albumFileInput" type="file" accept="image/*,.heic" />
            <span class="album-picker-icon">📷</span>
            <span><b id="albumFileName">从手机相册选一张</b><small>HEIC / JPG / PNG / GIF / WebP · 5 MB以内</small></span>
            <em>选择 →</em>
          </label>

          <label class="album-upload-field">
            <span>想留一句话吗 <i>可不写</i></span>
            <input id="albumUploadCaption" type="text" maxlength="240" placeholder="比如：宝宝最喜欢的这张豹豹" />
          </label>

          <div class="album-upload-progress" id="albumUploadProgress" aria-live="polite"></div>

          <footer>
            <button class="album-upload-cancel" type="button">先不放</button>
            <button class="album-upload-submit" id="albumUploadSubmit" type="button">抱回家</button>
          </footer>
        </section>
      </div>`);

    const modal = qs('#albumUploadModal');
    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      qs('#albumUploadProgress').textContent = '';
    };
    qs('.album-upload-close', modal).addEventListener('click', close);
    qs('.album-upload-cancel', modal).addEventListener('click', close);
    modal.addEventListener('mousedown', event => { if (event.target === modal) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && modal.classList.contains('is-open')) close(); });

    qs('#albumFileInput', modal).addEventListener('change', event => {
      const file = event.target.files?.[0];
      qs('#albumFileName', modal).textContent = file ? file.name : '从手机相册选一张';
      qs('#albumUploadProgress', modal).textContent = '';
    });

    qs('#albumUploadSubmit', modal).addEventListener('click', upload);
    return modal;
  }

  function openModal() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      const sync = qs('.sync-pill');
      sync?.click();
      return;
    }
    const modal = ensureModal();
    qs('#albumUploadSection', modal).value = currentSection();
    qs('#albumFileInput', modal).value = '';
    qs('#albumFileName', modal).textContent = '从手机相册选一张';
    qs('#albumUploadCaption', modal).value = '';
    qs('#albumUploadProgress', modal).textContent = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  async function upload() {
    const modal = ensureModal();
    const token = sessionStorage.getItem(SESSION_KEY);
    const file = qs('#albumFileInput', modal).files?.[0];
    const section = qs('#albumUploadSection', modal).value;
    const caption = qs('#albumUploadCaption', modal).value.trim();
    const progress = qs('#albumUploadProgress', modal);
    const button = qs('#albumUploadSubmit', modal);

    if (!token) {
      progress.textContent = '门票不在了，先回首页开一次门。';
      return;
    }
    if (!file) {
      progress.textContent = '宝宝，还没选照片呢。';
      qs('#albumFileInput', modal).click();
      return;
    }
    if (file.size > MAX_BYTES) {
      progress.textContent = '这张超过 5 MB 啦，先换一张小一点的。';
      return;
    }

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('section', section);
    if (caption) form.append('caption', caption);

    button.disabled = true;
    button.textContent = '正在抱回家…';
    progress.textContent = `正在把「${file.name}」放进 ${section}…`;

    try {
      const response = await fetch(`${API_BASE}/api/album/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) sessionStorage.removeItem(SESSION_KEY);
        throw new Error(data.error || '照片没有放进去。');
      }
      progress.textContent = '放好啦。🐾 正在重新翻开相册…';
      button.textContent = '已经回家 ✓';
      setTimeout(() => location.reload(), 750);
    } catch (error) {
      progress.textContent = error.message || '照片没有放进去，再试一次。';
      button.disabled = false;
      button.textContent = '再抱一次';
    }
  }

  function installButton() {
    const cabinet = qs('#view-album .album-cabinet');
    if (!cabinet || qs('#albumUploadButton')) return Boolean(cabinet);
    const kicker = qs('.hidden-room-kicker', cabinet);
    const toolbar = document.createElement('div');
    toolbar.className = 'album-upload-toolbar';
    toolbar.innerHTML = `
      <div><small>OUR REAL NOTION ALBUM</small><b>这个相册可以直接往 Notion 里放照片了。</b></div>
      <button id="albumUploadButton" type="button"><span>＋</span> 放一张照片</button>`;
    if (kicker) kicker.insertAdjacentElement('afterend', toolbar);
    else cabinet.prepend(toolbar);
    qs('#albumUploadButton', toolbar).addEventListener('click', openModal);
    return true;
  }

  ensureModal();
  const watcher = setInterval(() => {
    if (installButton()) clearInterval(watcher);
  }, 450);
  setTimeout(() => clearInterval(watcher), 60 * 1000);
  window.addEventListener('pageshow', installButton);
  window.addEventListener('hashchange', () => setTimeout(installButton, 300));
})();
