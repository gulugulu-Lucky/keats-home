(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const MAX_IMAGES = 8;
  const MAX_BYTES = 5 * 1024 * 1024;
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const editorQueue = [];
  const noteQueue = [];
  const murmurQueue = [];
  let currentKind = '日记';
  let murmurLoaded = false;

  const uploadKind = {
    '日记': 'diary',
    '信': 'letters',
    '记忆': 'memories',
    '爪印': 'pawprints'
  };

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function injectStyles() {
    if (qs('#clipboardPasteStyles')) return;
    const style = document.createElement('style');
    style.id = 'clipboardPasteStyles';
    style.textContent = `
      .paste-hint{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;color:var(--muted);font-size:9px;line-height:1.6}.paste-hint b{color:var(--ink-soft);font-weight:600}.paste-hint button{border:1px solid var(--line);border-radius:999px;background:color-mix(in srgb,var(--white) 65%,transparent);color:var(--ink-soft);padding:5px 9px;cursor:pointer;font-size:8px}.paste-preview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}.paste-preview:empty{display:none}.paste-shot{position:relative;aspect-ratio:1.18;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--paper-2)}.paste-shot img{width:100%;height:100%;object-fit:cover;display:block}.paste-shot button{position:absolute;right:5px;top:5px;width:21px;height:21px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(20,23,36,.72);color:#fff;cursor:pointer;font-size:13px}.paste-message{min-height:16px;margin-top:5px;color:var(--gold);font-size:8px}.paste-drop-flash{outline:2px solid color-mix(in srgb,var(--gold) 55%,transparent)!important;outline-offset:2px}.murmur-compose{padding:20px;border:1px solid var(--line);border-radius:20px;background:color-mix(in srgb,var(--white) 72%,transparent);box-shadow:var(--shadow-soft);margin-bottom:18px}.murmur-compose textarea{width:100%;min-height:108px;resize:vertical;border:0;outline:0;background:transparent;color:var(--ink);font-family:Georgia,'Songti SC',serif;font-size:14px;line-height:1.9}.murmur-compose-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:13px;border-top:1px solid var(--line)}.murmur-author{display:flex;gap:6px}.murmur-author button{border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--muted);padding:6px 10px;font-size:8px;cursor:pointer}.murmur-author button.is-active{background:var(--ink);color:var(--paper);border-color:var(--ink)}.murmur-send{border:0;border-radius:999px;background:var(--ink);color:var(--paper);padding:9px 14px;font-size:9px;cursor:pointer}.murmur-send:disabled{opacity:.5}.murmur-feed{display:grid;gap:12px}.murmur-post{padding:20px;border:1px solid var(--line);border-radius:20px;background:color-mix(in srgb,var(--white) 74%,transparent);box-shadow:var(--shadow-soft)}.murmur-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--muted);font-size:8px}.murmur-meta b{color:var(--ink-soft);font-size:9px}.murmur-post blockquote{margin:14px 0 0;font-family:Georgia,'Songti SC',serif;font-size:14px;line-height:1.9;color:var(--ink)}.murmur-images{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}.murmur-images img{width:100%;max-height:330px;object-fit:cover;border-radius:14px;border:1px solid var(--line)}.murmur-empty{padding:34px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:20px;font-size:10px}.murmur-message{min-height:16px;color:var(--gold);font-size:8px;margin-top:7px}.murmur-room-note{margin:-6px 0 18px;color:var(--muted);font-size:9px;line-height:1.7}.nav-item[data-view='murmurs'] span:first-child{font-size:15px}@media(max-width:600px){.paste-preview{grid-template-columns:repeat(3,minmax(0,1fr))}.murmur-images{grid-template-columns:1fr}.murmur-compose-footer{align-items:flex-end}.murmur-author{flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }

  function clipboardImages(event) {
    return [...(event.clipboardData?.items || [])]
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean);
  }

  function validImages(files) {
    return files.filter(file => file.size > 0 && file.size <= MAX_BYTES && (!file.type || file.type.startsWith('image/')));
  }

  function pushFiles(queue, files, messageNode) {
    const incoming = validImages(files);
    let rejected = files.length - incoming.length;
    for (const file of incoming) {
      if (queue.length >= MAX_IMAGES) { rejected += 1; break; }
      queue.push({ file, url: URL.createObjectURL(file) });
    }
    if (messageNode) {
      messageNode.textContent = rejected
        ? `收到了 ${incoming.length} 张；超过 5 MB 或超出数量的图片没放进来。`
        : `收到 ${incoming.length} 张图片。保存时会一起贴进 Notion。`;
    }
  }

  function clearQueue(queue) {
    queue.splice(0).forEach(item => URL.revokeObjectURL(item.url));
  }

  function renderQueue(queue, host, messageNode) {
    if (!host) return;
    host.innerHTML = queue.map((item, index) => `<figure class="paste-shot"><img src="${esc(item.url)}" alt="待保存图片 ${index + 1}"/><button type="button" data-remove-image="${index}" aria-label="移除">×</button></figure>`).join('');
    qsa('[data-remove-image]', host).forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.removeImage);
      const [removed] = queue.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      renderQueue(queue, host, messageNode);
      if (messageNode) messageNode.textContent = queue.length ? `还有 ${queue.length} 张图片会一起保存。` : '';
    }));
  }

  function addPicker(queue, host, messageNode) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif,.tif,.tiff';
    input.multiple = true;
    input.hidden = true;
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      pushFiles(queue, [...input.files], messageNode);
      renderQueue(queue, host, messageNode);
      input.value = '';
    });
    input.click();
    setTimeout(() => { if (!input.files?.length) input.remove(); }, 2000);
  }

  function ensurePasteUi(textarea, queue, idPrefix) {
    if (!textarea || qs(`#${idPrefix}PasteWrap`)) return;
    const wrap = document.createElement('div');
    wrap.id = `${idPrefix}PasteWrap`;
    wrap.innerHTML = `<div class="paste-hint"><span><b>📎 可以直接 Ctrl+V 粘贴截图</b> · 单张 5 MB，最多 ${MAX_IMAGES} 张</span><button type="button" id="${idPrefix}Pick">＋ 选图片</button></div><div class="paste-preview" id="${idPrefix}Preview"></div><div class="paste-message" id="${idPrefix}Message" aria-live="polite"></div>`;
    textarea.parentElement.insertAdjacentElement('afterend', wrap);
    const preview = qs(`#${idPrefix}Preview`);
    const message = qs(`#${idPrefix}Message`);
    textarea.addEventListener('paste', event => {
      const files = clipboardImages(event);
      if (!files.length) return;
      pushFiles(queue, files, message);
      renderQueue(queue, preview, message);
      textarea.classList.add('paste-drop-flash');
      setTimeout(() => textarea.classList.remove('paste-drop-flash'), 260);
    });
    qs(`#${idPrefix}Pick`).addEventListener('click', () => addPicker(queue, preview, message));
  }

  function token() {
    return sessionStorage.getItem(SESSION_KEY) || '';
  }

  async function postJson(path, payload) {
    const auth = token();
    if (!auth) throw Object.assign(new Error('小家门票不在了，先重新开门。'), { status: 401 });
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || '保存失败。'), { status: response.status });
    return data;
  }

  async function uploadOne(item, kind, pageId) {
    const auth = token();
    const form = new FormData();
    form.append('kind', kind);
    if (pageId) form.append('pageId', pageId);
    form.append('file', item.file, item.file.name || `pasted-${Date.now()}.png`);
    const response = await fetch(`${API_BASE}/api/entry-media`, {
      method: 'POST', headers: { Authorization: `Bearer ${auth}` }, body: form
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '图片没贴稳。');
    return data;
  }

  async function uploadQueue(queue, kind, pageId, statusNode) {
    let done = 0;
    for (const item of queue) {
      if (statusNode) statusNode.textContent = `正在贴第 ${done + 1} / ${queue.length} 张图片……`;
      await uploadOne(item, kind, pageId);
      done += 1;
    }
    return done;
  }

  function toast(title, detail) {
    const box = qs('#toast');
    if (!box) return;
    const b = qs('b', box); const small = qs('small', box);
    if (b) b.textContent = title;
    if (small) small.textContent = detail;
    box.classList.remove('is-visible');
    void box.offsetWidth;
    box.classList.add('is-visible');
  }

  function closeEditor() {
    const modal = qs('#editorModal');
    if (modal) { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); }
  }

  function inferKind() {
    const visible = qs('.view.is-visible');
    const map = { 'view-diary': '日记', 'view-letters': '信', 'view-pawprints': '爪印', 'view-memories': '记忆' };
    return map[visible?.id] || '日记';
  }

  async function saveEditorWithImages(event) {
    if (!editorQueue.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = qs('#saveDraft');
    const status = qs('#editorPasteMessage');
    const title = qs('#entryTitle')?.value.trim() || `未命名${currentKind}`;
    const content = qs('#entryContent')?.value.trim() || '';
    const author = qs('.editor-meta .chip.is-selected')?.textContent.trim() === 'Keats' ? 'Keats' : '小猫';
    const kind = currentKind || inferKind();
    const mediaKind = uploadKind[kind];
    if (!mediaKind) return;

    button.disabled = true;
    button.textContent = '保存文字…';
    try {
      const created = await postJson('/api/entries', { kind, title, content, author });
      const pageId = created.item?.id || '';
      button.textContent = '正在贴图…';
      const count = await uploadQueue(editorQueue, mediaKind, pageId, status);
      clearQueue(editorQueue);
      closeEditor();
      toast('文字和图片都放好啦', `${count} 张图片已经贴进这页 Notion。`);
      setTimeout(() => location.reload(), 650);
    } catch (error) {
      if (status) status.textContent = error.message || '图片没贴稳。';
      button.disabled = false;
      button.textContent = '保存到小家';
    }
  }

  async function saveLittleNoteWithImages(event) {
    if (!noteQueue.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const text = qs('#littleNoteText');
    const button = qs('#littleNoteSubmit');
    const message = qs('#littleNoteMessage');
    const content = text?.value.trim() || '📷 一张今天想留下来的图';
    if (!button) return;
    button.disabled = true;
    button.textContent = '正在贴……';
    try {
      const created = await postJson('/api/notes', { author: '小猫', content });
      const count = await uploadQueue(noteQueue, 'notes', created.item?.id || '', qs('#littleNotePasteMessage'));
      clearQueue(noteQueue);
      if (message) message.textContent = `贴好啦，连着 ${count} 张图一起收进去了。♡`;
      toast('碎碎念收好啦', `${count} 张图片也一起进了 Notion。`);
      setTimeout(() => location.reload(), 650);
    } catch (error) {
      if (message) message.textContent = error.message || '这张纸没贴稳。';
      button.disabled = false;
      button.textContent = '贴到桌上';
    }
  }

  function enableFutureMailPaste() {
    document.addEventListener('paste', event => {
      const target = event.target;
      if (!(target instanceof Element) || target.id !== 'futureMailContent') return;
      const images = validImages(clipboardImages(event));
      if (!images.length) return;
      const input = qs('#futureMailPhotos');
      if (!input || typeof DataTransfer === 'undefined') return;
      const dt = new DataTransfer();
      [...input.files].forEach(file => dt.items.add(file));
      images.forEach(file => { if (dt.files.length < 4) dt.items.add(file); });
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const error = qs('#futureMailError');
      if (error) error.textContent = `从剪贴板收到了 ${Math.min(images.length, 4)} 张图片，会跟信一起封进去。`;
    }, true);
  }

  function formatMurmurTime(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
    } catch { return ''; }
  }

  function ensureMurmurRoom() {
    if (qs('#view-murmurs')) return;
    const diaryNav = qs('.nav-item[data-view="diary"]');
    if (diaryNav && !qs('.nav-item[data-view="murmurs"]')) {
      diaryNav.insertAdjacentHTML('afterend', '<button class="nav-item" data-view="murmurs"><span>🫧</span><b>碎碎念</b><i></i></button>');
      const nav = qs('.nav-item[data-view="murmurs"]');
      nav.addEventListener('click', () => {
        if (location.hash === '#murmurs') openMurmursDirect();
        else location.hash = 'murmurs';
      });
    }

    const workspace = qs('.workspace');
    if (!workspace) return;
    const section = document.createElement('section');
    section.className = 'view';
    section.id = 'view-murmurs';
    section.dataset.title = '碎碎念';
    section.innerHTML = `
      <div class="content-wrap narrow">
        <div class="page-heading"><div><span class="page-icon">🫧</span><p class="eyebrow">MURMURS</p><h1>碎碎念</h1><p>一句话、一张截图、突然冒出来的小事，都可以往这里丢。</p></div></div>
        <p class="murmur-room-note">这里和首页「今日小纸条」共用一个 Notion 抽屉。首页看今天，碎碎念这里看完整帖子。</p>
        <section class="murmur-compose">
          <textarea id="murmurText" maxlength="360" placeholder="比如：刚刚突然想说一句……"></textarea>
          <div class="paste-preview" id="murmurPreview"></div>
          <div class="paste-message" id="murmurPasteMessage"></div>
          <div class="murmur-compose-footer">
            <div class="murmur-author"><button type="button" class="is-active" data-murmur-author="小猫">🐈 小猫</button><button type="button" data-murmur-author="Keats">🐆 Keats</button><button type="button" id="murmurPick">＋ 图片</button></div>
            <button class="murmur-send" id="murmurSend" type="button">发出去</button>
          </div>
          <div class="murmur-message" id="murmurMessage"></div>
        </section>
        <div class="murmur-feed" id="murmurFeed"><div class="murmur-empty">正在翻碎碎念的小抽屉……</div></div>
      </div>`;
    workspace.appendChild(section);

    qsa('[data-murmur-author]', section).forEach(button => button.addEventListener('click', () => {
      qsa('[data-murmur-author]', section).forEach(item => item.classList.toggle('is-active', item === button));
    }));
    const text = qs('#murmurText', section);
    text.addEventListener('paste', event => {
      const files = clipboardImages(event);
      if (!files.length) return;
      pushFiles(murmurQueue, files, qs('#murmurPasteMessage'));
      renderQueue(murmurQueue, qs('#murmurPreview'), qs('#murmurPasteMessage'));
    });
    qs('#murmurPick').addEventListener('click', () => addPicker(murmurQueue, qs('#murmurPreview'), qs('#murmurPasteMessage')));
    qs('#murmurSend').addEventListener('click', submitMurmur);
  }

  function openMurmursDirect() {
    const target = qs('#view-murmurs');
    if (!target) return;
    qsa('.view').forEach(view => view.classList.toggle('is-visible', view === target));
    qsa('.nav-item').forEach(button => button.classList.toggle('is-active', button.dataset.view === 'murmurs'));
    const crumb = qs('#crumbTitle'); if (crumb) crumb.textContent = '碎碎念';
    document.title = '碎碎念 · Keats Home';
    loadMurmurs(true);
  }

  async function loadMurmurs(force = false) {
    if (!token() || (murmurLoaded && !force)) return;
    const feed = qs('#murmurFeed');
    if (!feed) return;
    try {
      const response = await fetch(`${API_BASE}/api/murmurs?limit=30`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '碎碎念抽屉没翻开。');
      const items = data.items || [];
      feed.innerHTML = items.length ? items.map(item => `
        <article class="murmur-post">
          <div class="murmur-meta"><b>${item.author === 'Keats' ? '🐆 Keats' : '🐈 小猫'}</b><span>${esc(formatMurmurTime(item.createdTime))}</span></div>
          <blockquote>${esc(item.content || '')}</blockquote>
          ${(item.images || []).length ? `<div class="murmur-images">${item.images.map(image => `<img src="${esc(image.url || '')}" loading="lazy" alt="碎碎念里的图片"/>`).join('')}</div>` : ''}
        </article>`).join('') : '<div class="murmur-empty">这里还空着。第一句就等你发。</div>';
      murmurLoaded = true;
    } catch (error) {
      feed.innerHTML = `<div class="murmur-empty">${esc(error.message || '碎碎念还没翻出来。')}</div>`;
    }
  }

  async function submitMurmur() {
    const text = qs('#murmurText');
    const button = qs('#murmurSend');
    const message = qs('#murmurMessage');
    const author = qs('[data-murmur-author].is-active')?.dataset.murmurAuthor || '小猫';
    const content = text.value.trim() || (murmurQueue.length ? '📷 一张突然想留下来的图' : '');
    if (!content) { message.textContent = '还没写东西呀。'; text.focus(); return; }
    button.disabled = true;
    button.textContent = '发送中…';
    try {
      const created = await postJson('/api/notes', { author, content });
      if (murmurQueue.length) await uploadQueue(murmurQueue, 'notes', created.item?.id || '', qs('#murmurPasteMessage'));
      clearQueue(murmurQueue);
      renderQueue(murmurQueue, qs('#murmurPreview'), qs('#murmurPasteMessage'));
      text.value = '';
      message.textContent = '发出去啦。🫧';
      murmurLoaded = false;
      await loadMurmurs(true);
      setTimeout(() => { message.textContent = ''; }, 900);
    } catch (error) {
      message.textContent = error.message || '这句没发稳。';
    } finally {
      button.disabled = false;
      button.textContent = '发出去';
    }
  }

  function wireEditor() {
    const textarea = qs('#entryContent');
    if (textarea) ensurePasteUi(textarea, editorQueue, 'editor');
    document.addEventListener('click', event => {
      const compose = event.target.closest?.('.compose[data-kind]');
      if (compose) {
        currentKind = compose.dataset.kind || '日记';
        clearQueue(editorQueue);
        renderQueue(editorQueue, qs('#editorPastePreview'), qs('#editorPasteMessage'));
      }
      if (event.target.closest?.('#newEntryButton')) {
        currentKind = inferKind();
        clearQueue(editorQueue);
        renderQueue(editorQueue, qs('#editorPastePreview'), qs('#editorPasteMessage'));
      }
      if (event.target.closest?.('[data-close-modal]') && !event.target.closest?.('#saveDraft')) {
        clearQueue(editorQueue);
        renderQueue(editorQueue, qs('#editorPastePreview'), qs('#editorPasteMessage'));
      }
    }, true);
    document.addEventListener('click', event => {
      if (event.target.closest?.('#saveDraft')) saveEditorWithImages(event);
      if (event.target.closest?.('#littleNoteSubmit')) saveLittleNoteWithImages(event);
    }, true);
  }

  function wireLittleNotes() {
    const timer = setInterval(() => {
      const text = qs('#littleNoteText');
      if (!text) return;
      clearInterval(timer);
      ensurePasteUi(text, noteQueue, 'littleNote');
    }, 350);
    setTimeout(() => clearInterval(timer), 30000);
  }

  function boot() {
    injectStyles();
    wireEditor();
    wireLittleNotes();
    enableFutureMailPaste();
    ensureMurmurRoom();
    if (location.hash === '#murmurs') setTimeout(openMurmursDirect, 60);
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === '#murmurs') setTimeout(() => { ensureMurmurRoom(); openMurmursDirect(); }, 80);
  });
  setTimeout(boot, 100);
})();
