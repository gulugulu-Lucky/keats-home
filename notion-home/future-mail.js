(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
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
          <p class="future-mail-error" id="futureMailError"></p>
          <footer><small>寄件人固定为 🐈 小猫。日期没到以前，API 不返回正文。</small><div><button class="soft-button" id="futureMailCancel" type="button">取消</button><button class="primary-button" id="futureMailSend" type="button">封好并投递</button></div></footer>
        </section>
      </div>`);

    const modal = qs('#futureMailModal');
    const close = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); };
    qs('#futureMailClose').addEventListener('click', close);
    qs('#futureMailCancel').addEventListener('click', close);
    modal.addEventListener('mousedown', event => { if (event.target === modal) close(); });
    qsa('[data-future-method]', modal).forEach(button => button.addEventListener('click', () => setMethod(button.dataset.futureMethod)));
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
    if (!content) { error.textContent = '信纸还是空的。'; return; }
    if (state.method !== '现在寄出' && !openDate) { error.textContent = '还没选开封日期。'; return; }
    button.disabled = true;
    error.textContent = '';
    try {
      await api('/api/future-mail', {
        method: 'POST',
        body: JSON.stringify({ title, content, recipient, author: '小猫', method: state.method, openDate })
      });
      const modal = qs('#futureMailModal');
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      state.loaded = false;
      await loadMail(true);
      const toast = qs('#toast');
      if (toast) {
        qs('b', toast).textContent = state.method === '现在寄出' ? '信已经寄到了' : '信封好啦';
        qs('small', toast).textContent = state.method === '现在寄出' ? '现在就可以拆' : `等 ${dateLabel(openDate)} 再开封`;
        toast.classList.remove('is-visible'); void toast.offsetWidth; toast.classList.add('is-visible');
      }
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
      button.textContent = state.method === '现在寄出' ? '现在寄出' : '封好并投递';
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
      grid.innerHTML = '<article class="future-mail-empty"><span>✉</span><b>邮袋还是空的。</b><p>写第一封给未来的信吧。</p></article>';
      return;
    }

    grid.innerHTML = items.map(item => item.opened ? `
      <article class="future-envelope arrived" tabindex="0">
        <header><span>${esc(item.author || '')} → ${esc(item.recipient || '')}</span><span>${esc(dateLabel(item.openDate))}</span></header>
        <h3>${esc(item.title || '一封已经到达的信')}</h3>
        <p>这封信已经到达。点一下拆开。</p>
        <div class="future-letter-body">${esc(item.content || '')}</div>
      </article>` : `
      <article class="future-envelope sealed">
        <header><span>${esc(item.author || '')} → ${esc(item.recipient || '')}</span><span>${esc(item.method || '')}</span></header>
        <h3>${esc(item.title || '一封封存中的信')}</h3>
        <p>开封日：${esc(dateLabel(item.openDate))}</p>
        <span class="future-countdown">还有 ${Number(item.daysLeft) || 0} 天开封</span>
      </article>`).join('');

    qsa('.future-envelope.arrived', grid).forEach(card => {
      const toggle = () => card.classList.toggle('is-open');
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