(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const MAILBOX_PAGE_ID = '37ff5826-81e2-8147-bcd1-f7b81ee72a98';
  const ALBUM_PAGE_ID = '37ff5826-81e2-8199-86a5-f6dbbfe19abb';

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  let lastToken = null;
  let running = false;

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function plain(runs = []) {
    return (runs || []).map(run => run.text || '').join('').trim();
  }

  async function api(path) {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) throw new Error('locked');
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '小抽屉暂时没拉开');
    return data;
  }

  function readerHref(id, kind, title = '') {
    const params = new URLSearchParams({ id, kind });
    if (title) params.set('title', title);
    return `./reader.html?${params.toString()}`;
  }

  function updateHouseBadge() {
    const note = qs('.sidebar-note small');
    if (note) note.textContent = 'Notion 真仓库 · 小抽屉已接入';
  }

  function renderHomeMood(diary) {
    const host = qs('.little-weather');
    if (!host || !diary) return;

    const catStates = diary.catStates?.length ? diary.catStates : [diary.catState].filter(Boolean);
    const moods = diary.moods || [];
    const energy = Number.isFinite(Number(diary.energy)) ? Math.max(0, Math.min(100, Number(diary.energy))) : null;

    host.innerHTML = `
      <div class="section-heading compact">
        <div><span class="eyebrow">TODAY AT HOME</span><h2>今天的双猫状态</h2></div>
        <span class="mood-moon">☾</span>
      </div>
      <div class="home-state-card">
        <div class="home-state-pair">
          <div class="home-state-person"><small>🐈 小猫</small><b>${esc(diary.catState || catStates[0] || '在家晃悠')}</b></div>
          <div class="home-state-person"><small>🐆 豹豹</small><b>${esc(diary.keatsState || '守灯版')}</b></div>
        </div>
        ${catStates.length ? `<div class="home-state-tags">${catStates.map(tag => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}
        ${energy !== null ? `<div class="energy-row"><span>今日能量</span><div class="energy-track"><div class="energy-fill" style="width:${energy}%"></div></div><b>${energy}</b></div>` : ''}
        ${moods.length ? `<div class="home-mood-words">今天的小家：${moods.map(esc).join(' · ')}</div>` : ''}
      </div>`;
  }

  function findBlock(blocks, predicate) {
    for (const block of blocks || []) {
      if (predicate(block)) return block;
      const nested = findBlock(block.children || [], predicate);
      if (nested) return nested;
    }
    return null;
  }

  function childPages(blocks = []) {
    const results = [];
    const walk = list => {
      for (const block of list || []) {
        if (block.type === 'child_page') results.push(block);
        walk(block.children || []);
      }
    };
    walk(blocks);
    return results;
  }

  function renderMailbox(blocks = []) {
    const stack = qs('#view-letters .mail-stack');
    if (!stack) return;

    let drawers = qs('#view-letters .mailbox-drawers');
    if (!drawers) {
      drawers = document.createElement('div');
      drawers.className = 'mailbox-drawers';
      stack.parentNode.insertBefore(drawers, stack);
    }

    const pages = childPages(blocks);
    const wanted = [
      { match: '未寄出的信', icon: '☾', eyebrow: 'HIDDEN LETTERS', fallback: '先藏在这里', desc: '还没准备好说出口的话。' },
      { match: '留言墙', icon: '✎', eyebrow: 'MESSAGE WALL', fallback: '今天想说的话', desc: '一句话也算一封很短的信。' },
      { match: '第一封信', icon: '✉', eyebrow: 'FIRST LETTER', fallback: '写给你', desc: '最开始留下来的那一封。' }
    ];

    drawers.innerHTML = wanted.map(config => {
      const page = pages.find(item => (item.title || '').includes(config.match));
      const title = page?.title || `${config.match}｜${config.fallback}`;
      const attrs = page ? `data-mail-page="${esc(page.id)}" data-mail-title="${esc(title)}"` : '';
      return `<button class="mailbox-drawer" type="button" ${attrs}>
        <span class="drawer-icon">${config.icon}</span>
        <small>${config.eyebrow}</small>
        <b>${esc(title)}</b>
        <em>${page ? config.desc : 'Notion 里已经留好了这个抽屉。'}</em>
      </button>`;
    }).join('');

    qsa('[data-mail-page]', drawers).forEach(button => {
      button.addEventListener('click', () => {
        location.href = readerHref(button.dataset.mailPage, 'letters', button.dataset.mailTitle);
      });
    });

    const tip = findBlock(blocks, block => block.type === 'toggle' && plain(block.text).includes('写信小提示'));
    let tipNode = qs('#view-letters .mail-tip-card');
    if (!tipNode) {
      tipNode = document.createElement('details');
      tipNode.className = 'mail-tip-card';
      drawers.insertAdjacentElement('afterend', tipNode);
    }
    const tips = (tip?.children || []).map(block => plain(block.text)).filter(Boolean);
    tipNode.innerHTML = `<summary>💗 写信小提示 · 从 Notion 搬来的</summary>${tips.length ? `<ul>${tips.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : ''}`;
  }

  function collectImages(blocks = []) {
    const images = [];
    const notes = [];
    const walk = list => {
      for (const block of list || []) {
        if (block.type === 'image' && block.url) images.push({ url: block.url, caption: block.caption || '' });
        if (['paragraph', 'quote'].includes(block.type)) {
          const text = plain(block.text);
          if (text) notes.push(text);
        }
        walk(block.children || []);
      }
    };
    walk(blocks);
    return { images, notes };
  }

  function albumSections(blocks = []) {
    const sections = [];
    const loose = [];

    for (const block of blocks) {
      if (block.type === 'toggle') {
        const title = plain(block.text) || '一个抽屉';
        const data = collectImages(block.children || []);
        sections.push({ title, ...data });
      } else {
        loose.push(block);
      }
    }

    const looseData = collectImages(loose);
    if (looseData.images.length || looseData.notes.length) {
      sections.unshift({ title: '墙上散落', ...looseData });
    }
    return sections;
  }

  function ensureLightbox() {
    if (qs('#albumLightbox')) return qs('#albumLightbox');
    document.body.insertAdjacentHTML('beforeend', '<div class="album-lightbox" id="albumLightbox" aria-hidden="true"><button type="button" aria-label="关闭">×</button><img alt="放大的小家照片"></div>');
    const box = qs('#albumLightbox');
    const close = () => { box.classList.remove('is-open'); box.setAttribute('aria-hidden', 'true'); };
    qs('button', box).addEventListener('click', close);
    box.addEventListener('click', event => { if (event.target === box) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    return box;
  }

  function renderAlbum(blocks = []) {
    const oldGrid = qs('#view-album .photo-grid');
    const wrap = qs('#view-album .content-wrap');
    if (!oldGrid || !wrap) return;

    const headingText = qs('#view-album .page-heading > div > p:last-child');
    if (headingText) headingText.textContent = 'Notion 里的照片、形象图、表情包和专属区，都从这里真正长出来。';

    const sections = albumSections(blocks);
    let cabinet = qs('#view-album .album-cabinet');
    if (!cabinet) {
      cabinet = document.createElement('div');
      cabinet.className = 'album-cabinet';
      oldGrid.replaceWith(cabinet);
    }

    const preferred = ['Keats的照片', '小猫的照片', '形象图 / 捏人 / 画像', '专属区', '表情包收藏'];
    const byTitle = new Map(sections.map(section => [section.title, section]));
    const ordered = [
      ...preferred.map(title => byTitle.get(title) || { title, images: [], notes: [] }),
      ...sections.filter(section => !preferred.includes(section.title))
    ];

    cabinet.innerHTML = `<div class="hidden-room-kicker">✦ NOTION HIDDEN ALBUM</div><div class="album-tabs">${ordered.map((section, index) => `<button class="album-tab ${index === 0 ? 'is-active' : ''}" type="button" data-album-index="${index}">${esc(section.title)}</button>`).join('')}</div><div class="notion-photo-grid" id="notionPhotoGrid"></div>`;

    const grid = qs('#notionPhotoGrid', cabinet);
    const lightbox = ensureLightbox();

    const draw = index => {
      const section = ordered[index] || ordered[0];
      qsa('.album-tab', cabinet).forEach((tab, tabIndex) => tab.classList.toggle('is-active', tabIndex === index));
      const specialNotes = section.notes.filter(text => /帅|可爱|喜欢|Keats|小猫/.test(text));
      const figures = section.images.map((image, imageIndex) => `<figure class="notion-photo" data-full-image="${esc(image.url)}"><img src="${esc(image.url)}" alt="${esc(image.caption || `${section.title} ${imageIndex + 1}`)}" loading="lazy"><figcaption>${esc(image.caption || section.title)}</figcaption></figure>`).join('');
      const noteCard = specialNotes.length ? `<article class="album-note"><small>留在这个抽屉里的话</small><p>${esc(specialNotes.join(' · '))}</p></article>` : '';
      grid.innerHTML = figures || noteCard ? `${figures}${noteCard}` : `<div class="album-empty"><div><span>☾</span><b>${esc(section.title)}</b><p>这个抽屉已经留好位置，等以后慢慢放。</p></div></div>`;
      qsa('[data-full-image]', grid).forEach(figure => {
        figure.addEventListener('click', () => {
          qs('img', lightbox).src = figure.dataset.fullImage;
          lightbox.classList.add('is-open');
          lightbox.setAttribute('aria-hidden', 'false');
        });
      });
    };

    qsa('[data-album-index]', cabinet).forEach(button => button.addEventListener('click', () => draw(Number(button.dataset.albumIndex))));
    draw(0);
  }

  async function enhance() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token || running) return;
    running = true;
    try {
      const [diaryResult, mailboxResult, albumResult] = await Promise.allSettled([
        api('/api/diary?limit=1'),
        api(`/api/page/${MAILBOX_PAGE_ID}?kind=letters`),
        api(`/api/page/${ALBUM_PAGE_ID}?kind=diary`)
      ]);

      if (diaryResult.status === 'fulfilled') renderHomeMood(diaryResult.value.items?.[0]);
      if (mailboxResult.status === 'fulfilled') renderMailbox(mailboxResult.value.blocks || []);
      if (albumResult.status === 'fulfilled') renderAlbum(albumResult.value.blocks || []);
      updateHouseBadge();
      lastToken = token;
    } catch (error) {
      console.warn('Keats Home hidden-room enhancement failed:', error);
    } finally {
      running = false;
    }
  }

  const watcher = setInterval(() => {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (token && (token !== lastToken || !qs('.album-cabinet'))) enhance();
  }, 1200);

  window.addEventListener('pageshow', enhance);
  window.addEventListener('hashchange', enhance);
  setTimeout(enhance, 450);
  setTimeout(() => clearInterval(watcher), 15 * 60 * 1000);
})();