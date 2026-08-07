(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const MAX_PHOTOS = 4;
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const state = { loading: false, loaded: false, method: '封存到某一天' };

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function shanghaiDate() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function dateLabel(value) {
    if (!value) return '';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return value;
    return `${match[1]} 年 ${Number(match[2])} 月 ${Number(match[3])} 日`;
  }

  function receiptLabel(item) {
    const recipient = item.recipient === 'Keats' ? 'Keats' : '小猫';
    if (item.receiptStatus === '已收件') {
      return `${recipient} 已收件${item.receivedDate ? ` · ${dateLabel(item.receivedDate)}` : ''}`;
    }
    return `等待 ${recipient} 收件`;
  }

  async function api(path, init = {}) {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) throw Object.assign(new Error('先用小家钥匙开门。'), { status: 401 });
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || '邮局暂时没接稳。'), { status: response.status });
    return data;
  }

  async function uploadApi(path, form) {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) throw Object.assign(new Error('先用小家钥匙开门。'), { status: 401 });
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || '照片没有塞进信封。'), { status: response.status });
    return data;
  }

  function photoFiles() {
    return [...(qs('#futureMailPhotos')?.files || [])];
  }

  function renderPhotoPreview() {
    const box = qs('#futureMailPhotoPreview');
    if (!box) return;
    const files = photoFiles();
    if (!files.length) {
      box.innerHTML = '<small>可以不放照片。要放的话，最多 4 张。</small>';
      return;
    }
    box.innerHTML = files.slice(0, MAX_PHOTOS).map((file, index) => {
      const url = URL.createObjectURL(file);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return `<figure><img src="${esc(url)}" alt="第 ${index + 1} 张待投递照片" /><figcaption>${esc(file.name || `照片 ${index + 1}`)}</figcaption></figure>`;
    }).join('') + (files.length > MAX_PHOTOS ? `<small class="future-photo-warning">只会收前 ${MAX_PHOTOS} 张。</small>` : '');
  }

  function ensureModal() {
    if (qs('#futureMailModal')) return qs('#futureMailModal');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="future-mail-modal" id="futureMailModal" aria-hidden="true">
        <section class="future-mail-sheet" role="dialog" aria-modal="true" aria-labelledby="futureMailModalTitle">
          <header><div><small class="eyebrow">FUTURE POST</small><h2 id="futureMailModalTitle">写一封给未来的信</h2></div><button class="icon-button" id="futureMailClose" type="button">×</button></header>
          <label>标题<input id="futureMailTitle" maxlength="100" placeholder="比如：给明年的你" /></label>
          <label>收件人<select id="futureMailRecipient"><option value="Keats">Keats</option><option value="小猫">未来的小猫</option></select></label>
          <label>投递方式<div class="future-mail-methods"><button type="button" data-future-method="现在寄出">现在寄出</button><button type="button" data-future-method="定时投递">定时投递</button><button type="button" data-future-method="封存到某一天" class="is-active">封存到某一天</button></div></label>
          <label id="futureMailDateRow">开封日期<input id="futureMailOpenDate" type="date" /></label>
          <label>正文<textarea id="futureMailContent" maxlength="2000" placeholder="这段话，等时间到了再给它看。"></textarea></label>
          <label>照片（可选）
            <div class="future-mail-photo-picker">
              <input id="futureMailPhotos" type="file" accept="image/*,.heic,.heif,.tif,.tiff" multiple />
              <span>最多 ${MAX_PHOTOS} 张 · 单张 5 MB</span>
            </div>
            <div class="future-mail-photo-preview" id="futureMailPhotoPreview"><small>可以不放照片。要放的话，最多 4 张。</small></div>
          </label>
          <p class="future-mail-error" id="futureMailError"></p>
          <footer><small>网页寄件人固定为 🐈 小猫；🐆 Keats 的信由 Keats 自己投递。未来信日期没到以前，正文和照片都不会交给前端。</small><div><button class="soft-button" id="futureMailCancel" type="button">取消</button><button class="primary-button" id="futureMailSend" type="button">封好并投递</button></div></footer>
        </section>
      </div>`);

    const modal = qs('#futureMailModal');
    const close = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); };
    qs('#futureMailClose').addEventListener('click', close);
    qs('#futureMailCancel').addEventListener('click', close);
    modal.addEventListener('mousedown', event => { if (event.target === modal) close(); });
    qsa('[data-future-method]', modal).forEach(button => button.addEventListener('click', () => setMethod(button.dataset.futureMethod)));
    qs('#futureMailPhotos').addEventListener('change', renderPhotoPreview);
    qs('#futureMailSend').addEventListener('click', sendMail);
    return modal;
  }

  function setMethod(method) {
    state.method = method;
    qsa('[data-future-method]').forEach(button => button.classList.toggle('is-active', button.dataset.futureMethod === method));
    const dateRow = qs('#futureMailDateRow');
    if (dateRow) dateRow.style.display = method === '现在寄出' ? 'none' : 'block';
    const send = qs('#futureMailSend');
    if (send) send.textContent = method === '现在寄出' ? '现在寄出' : '封好并投递';
  }

  function openComposer() {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      qs('.sync-pill')?.click();
      return;
    }
    const modal = ensureModal();
    qs('#futureMailTitle').value = '';
    qs('#futureMailContent').value = '';
    qs('#futureMailRecipient').value = 'Keats';
    qs('#futureMailPhotos').value = '';
    renderPhotoPreview();
    const date = qs('#futureMailOpenDate');
    date.min = shanghaiDate();
    const tomorrow = new Date(`${shanghaiDate()}T00:00:00+08:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(tomorrow);
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    date.value = `${map.year}-${map.month}-${map.day}`;
    qs('#futureMailError').textContent = '';
    setMethod('封存到某一天');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => qs('#futureMailTitle').focus(), 60);
  }

  async function sendMail() {
    const error = qs('#futureMailError');
    const button = qs('#futureMailSend');
    const content = qs('#futureMailContent').value.trim();
    const title = qs('#futureMailTitle').value.trim();
    const recipient = qs('#futureMailRecipient').value;
    const openDate = qs('#futureMailOpenDate').value;
    const files = photoFiles();
    if (!content) { error.textContent = '信纸还是空的。'; return; }
    if (state.method !== '现在寄出' && !openDate) { error.textContent = '还没选开封日期。'; return; }
    if (files.length > MAX_PHOTOS) { error.textContent = `一封信最多放 ${MAX_PHOTOS} 张照片。`; return; }
    const oversized = files.find(file => file.size > MAX_PHOTO_BYTES);
    if (oversized) { error.textContent = `「${oversized.name || '这张照片'}」超过 5 MB。`; return; }

    button.disabled = true;
    button.textContent = files.length ? '正在封照片…' : (state.method === '现在寄出' ? '正在寄出…' : '正在封信…');
    error.textContent = '';
    let photoFailures = 0;
    try {
      const created = await api('/api/future-mail', {
        method: 'POST',
        body: JSON.stringify({ title, content, recipient, method: state.method, openDate })
      });
      const mailId = created.item?.id;
      if (files.length && !mailId) throw new Error('信已经写好，但邮局没有返回信封编号。');

      for (const file of files) {
        const form = new FormData();
        form.append('mailId', mailId);
        form.append('file', file, file.name || `future-photo-${Date.now()}.jpg`);
        try { await uploadApi('/api/future-mail/photo', form); }
        catch { photoFailures += 1; }
      }

      const modal = qs('#futureMailModal');
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      state.loaded = false;
      await loadMail(true);
      const toast = qs('#toast');
      if (toast) {
        qs('b', toast).textContent = photoFailures ? '信寄到了，照片有一点小插曲' : (state.method === '现在寄出' ? '信已经寄到了' : '信封好啦');
        qs('small', toast).textContent = photoFailures
          ? `${files.length - photoFailures} 张照片已收好，${photoFailures} 张没有上传成功。`
          : (files.length ? `信里一起封好了 ${files.length} 张照片。` : (recipient === 'Keats' ? '邮局会等 Keats 来收件。' : (state.method === '现在寄出' ? '现在就可以拆' : `等 ${dateLabel(openDate)} 再开封`)));
        toast.classList.remove('is-visible'); void toast.offsetWidth; toast.classList.add('is-visible');
      }
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
      button.textContent = state.method === '现在寄出' ? '现在寄出' : '封好并投递';
    }
  }

  async function loadMedia(card, mailId) {
    const box = qs('.future-letter-images', card);
    if (!box || box.dataset.loaded === '1' || box.dataset.loading === '1') return;
    box.dataset.loading = '1';
    box.innerHTML = '<small>正在把一起封存的照片拿出来…</small>';
    try {
      const data = await api(`/api/future-mail/media?mailId=${encodeURIComponent(mailId)}`);
      const images = data.opened ? (data.images || []) : [];
      box.dataset.loaded = '1';
      box.innerHTML = images.length ? images.map((image, index) => `
        <figure>
          <img src="${esc(image.url || '')}" alt="信里的第 ${index + 1} 张照片" loading="lazy" />
          ${image.caption ? `<figcaption>${esc(image.caption)}</figcaption>` : ''}
        </figure>`).join('') : '';
      box.hidden = !images.length;
    } catch {
      box.innerHTML = '<small>照片暂时没拿出来，等会再拆一次。</small>';
    } finally {
      delete box.dataset.loading;
    }
  }

  function render(items = []) {
    const grid = qs('#futureMailGrid');
    if (!grid) return;
    const sealed = items.filter(item => !item.opened).length;
    const arrived = items.filter(item => item.opened).length;
    const stats = qs('#futureMailStats');
    if (stats) stats.innerHTML = `<span><b>${sealed}</b><small>封存中</small></span><span><b>${arrived}</b><small>已到达</small></span><span><b>${items.length}</b><small>全部来信</small></span>`;

    if (!items.length) {
      grid.innerHTML = '<article class="future-mail-empty"><span>✉</span><b>邮袋还是空的。</b><p>哪天突然想写的时候再来，不催你。</p></article>';
      return;
    }

    grid.innerHTML = items.map(item => item.opened ? `
      <article class="future-envelope arrived" tabindex="0" data-mail-id="${esc(item.id || '')}">
        <header><span>${esc(item.author || '')} → ${esc(item.recipient || '')}</span><span>${esc(dateLabel(item.openDate))}</span></header>
        <h3>${esc(item.title || '一封已经到达的信')}</h3>
        <p>这封信已经到达。点一下拆开。</p>
        <span class="future-receipt ${item.receiptStatus === '已收件' ? 'is-received' : ''}">${esc(receiptLabel(item))}</span>
        <div class="future-letter-body">${esc(item.content || '')}</div>
        <div class="future-letter-images" hidden></div>
      </article>` : `
      <article class="future-envelope sealed">
        <header><span>${esc(item.author || '')} → ${esc(item.recipient || '')}</span><span>${esc(item.method || '')}</span></header>
        <h3>${esc(item.title || '一封封存中的信')}</h3>
        <p>开封日：${esc(dateLabel(item.openDate))}</p>
        <span class="future-countdown">还有 ${Number(item.daysLeft) || 0} 天开封</span>
        <span class="future-receipt ${item.receiptStatus === '已收件' ? 'is-received' : ''}">${esc(receiptLabel(item))}</span>
      </article>`).join('');

    qsa('.future-envelope.arrived', grid).forEach(card => {
      const toggle = () => {
        const opening = !card.classList.contains('is-open');
        card.classList.toggle('is-open');
        if (opening) loadMedia(card, card.dataset.mailId);
      };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
    });
  }

  async function loadMail(force = false) {
    if (state.loading || (state.loaded && !force)) return;
    const grid = qs('#futureMailGrid');
    if (!grid) return;
    if (!sessionStorage.getItem(SESSION_KEY)) {
      grid.innerHTML = '<article class="future-mail-locked"><span>🔐</span><b>邮局还没开门。</b><p>先用顶部的小家钥匙开门。</p></article>';
      return;
    }
    state.loading = true;
    try {
      const data = await api('/api/future-mail?limit=100');
      render(data.items || []);
      state.loaded = true;
    } catch (error) {
      grid.innerHTML = `<article class="future-mail-locked"><span>☾</span><b>邮袋暂时没拿到。</b><p>${esc(error.message)}</p></article>`;
    } finally {
      state.loading = false;
    }
  }

  function boot() {
    if (!qs('#view-futuremail')) return;
    const compose = qs('#futureMailCompose');
    if (compose && compose.dataset.futureComposeBound !== '1') {
      compose.dataset.futureComposeBound = '1';
      compose.addEventListener('click', openComposer);
    }
    qsa('[data-view="futuremail"]').forEach(button => {
      if (button.dataset.futureMailBound === '1') return;
      button.dataset.futureMailBound = '1';
      button.addEventListener('click', () => setTimeout(() => loadMail(), 80));
    });
    if (location.hash === '#futuremail') loadMail();
  }

  window.addEventListener('pageshow', boot);
  window.addEventListener('hashchange', () => { if (location.hash === '#futuremail') loadMail(); });
  setTimeout(boot, 560);

  let checks = 0;
  const tokenWaiter = setInterval(() => {
    checks += 1;
    if (sessionStorage.getItem(SESSION_KEY)) {
      clearInterval(tokenWaiter);
      if (location.hash === '#futuremail') loadMail(true);
    } else if (checks >= 120) clearInterval(tokenWaiter);
  }, 1000);
})();
