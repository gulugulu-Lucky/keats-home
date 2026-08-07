(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const ALBUM_PAGE_ID = '37ff5826-81e2-8199-86a5-f6dbbfe19abb';

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const state = { loaded: false, loading: false, selected: '', data: null };

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function shanghaiParts() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    return Object.fromEntries(parts.map(part => [part.type, part.value]));
  }

  function currentMonth() {
    const now = shanghaiParts();
    return `${now.year}-${now.month}`;
  }

  function monthKey(value) {
    if (!value) return '';
    const raw = String(value);
    const direct = raw.match(/^(\d{4})-(\d{2})/);
    if (direct) return `${direct[1]}-${direct[2]}`;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit'
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}`;
  }

  function monthLabel(key) {
    const [year, month] = key.split('-');
    return `${year} 年 ${Number(month)} 月`;
  }

  function shortDate(value) {
    if (!value) return '';
    const raw = String(value);
    const match = raw.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (match) return `${Number(match[1])} 月 ${Number(match[2])} 日`;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric' }).format(date);
  }

  async function api(path) {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) throw Object.assign(new Error('先把小家的门打开，月刊才拿得到真实内容。'), { status: 401 });
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || '月刊编辑部暂时没拿到资料。'), { status: response.status });
    return data;
  }

  function walkImages(blocks = [], output = []) {
    for (const block of blocks || []) {
      if (block.type === 'image' && block.url) {
        output.push({ url: block.url, caption: block.caption || '收在小家相册里的照片' });
      }
      walkImages(block.children || [], output);
    }
    return output;
  }

  function dated(item, preferred = 'date') {
    return item?.[preferred] || item?.createdTime || '';
  }

  function inMonth(items, key, preferred = 'date') {
    return (items || []).filter(item => monthKey(dated(item, preferred)) === key);
  }

  function collectMonths(data) {
    const months = new Set([currentMonth()]);
    const groups = [data.diary, data.letters, data.memories, data.timeline, data.quotes, data.notes];
    groups.flat().forEach(item => {
      const key = monthKey(item?.date || item?.createdTime);
      if (key) months.add(key);
    });
    (data.songs || []).forEach(item => {
      const key = monthKey(item.createdTime);
      if (key) months.add(key);
    });
    return [...months].sort().reverse();
  }

  function issueData(data, key) {
    return {
      diary: inMonth(data.diary, key),
      letters: inMonth(data.letters, key),
      notes: inMonth(data.notes, key),
      memories: inMonth(data.memories, key),
      timeline: inMonth(data.timeline, key),
      quotes: inMonth(data.quotes, key),
      songs: inMonth(data.songs, key, 'createdTime')
    };
  }

  function importanceNumber(value) {
    const stars = String(value || '').match(/⭐/g)?.length || 0;
    return stars;
  }

  function keywordList(issue) {
    const counts = new Map();
    const add = value => {
      String(value || '').split(/[·、,，/]/).map(x => x.trim()).filter(Boolean).forEach(word => {
        if (word.length > 10) return;
        counts.set(word, (counts.get(word) || 0) + 1);
      });
    };
    issue.diary.forEach(item => [...(item.moods || []), ...(item.types || [])].forEach(add));
    issue.memories.forEach(item => [item.category, item.type, item.module].forEach(add));
    issue.timeline.forEach(item => add(item.type));
    issue.quotes.forEach(item => (item.feelings || []).forEach(add));
    issue.songs.forEach(item => (item.moods || []).forEach(add));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')).slice(0, 5).map(([word]) => word);
  }

  function issueCount(issue) {
    return Object.values(issue).reduce((sum, list) => sum + list.length, 0);
  }

  function issueSummary(issue, key) {
    const pieces = [];
    if (issue.diary.length) pieces.push(`${issue.diary.length} 篇日记`);
    if (issue.notes.length) pieces.push(`${issue.notes.length} 张纸条`);
    if (issue.letters.length) pieces.push(`${issue.letters.length} 封信`);
    if (issue.memories.length) pieces.push(`${issue.memories.length} 枚记忆`);
    if (issue.timeline.length) pieces.push(`${issue.timeline.length} 个节点`);
    if (issue.quotes.length) pieces.push(`${issue.quotes.length} 句话`);
    if (issue.songs.length) pieces.push(`${issue.songs.length} 首歌`);
    const prefix = key === currentMonth() ? '这一册还在继续长。到现在为止，已经装进了' : '这一册已经合上。那个月，小家留下了';
    return pieces.length ? `${prefix}${pieces.join('、')}。` : `${prefix.replace(/，?已经装进了|，?小家留下了/, '')}，纸页还很安静。`;
  }

  function statusText(key) {
    return key === currentMonth() ? '正在装订' : '已装订';
  }

  function volumeNumber(months, key) {
    const ascending = [...months].sort();
    return String(ascending.indexOf(key) + 1).padStart(2, '0');
  }

  function renderShelf(months, data) {
    const host = qs('#magazineShelf');
    if (!host) return;
    host.innerHTML = months.map(key => {
      const issue = issueData(data, key);
      const keywords = keywordList(issue);
      return `<button class="magazine-spine ${state.selected === key ? 'is-active' : ''}" type="button" data-magazine-month="${esc(key)}">
        <small>VOL. ${volumeNumber(months, key)}</small>
        <b>${esc(monthLabel(key))}</b>
        <span>${esc(keywords[0] || (key === currentMonth() ? '正在发生' : '小家存档'))}</span>
        <i>${esc(statusText(key))}</i>
      </button>`;
    }).join('');
    qsa('[data-magazine-month]', host).forEach(button => {
      button.addEventListener('click', () => {
        state.selected = button.dataset.magazineMonth;
        renderMagazine();
        qs('#magazineBook')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function itemCard(item, kind, textKey, kicker) {
    const body = item?.[textKey] || item?.summary || item?.text || item?.note || item?.quote || item?.reason || '';
    const href = item?.url || '';
    return `<article class="magazine-entry ${href ? 'is-openable' : ''}" ${href ? `data-mag-url="${esc(href)}"` : ''}>
      <small>${esc(kicker || shortDate(item.date || item.createdTime) || kind)}</small>
      <h4>${esc(item.title || (kind === 'quote' ? '一句被留下来的话' : '没有标题的一页'))}</h4>
      ${body ? `<p>${esc(body)}</p>` : ''}
    </article>`;
  }

  function section(title, eyebrow, body, count) {
    if (!body) return '';
    return `<section class="magazine-section">
      <header><div><small>${esc(eyebrow)}</small><h3>${esc(title)}</h3></div>${Number.isFinite(count) ? `<span>${count}</span>` : ''}</header>
      ${body}
    </section>`;
  }

  function renderDiary(issue) {
    if (!issue.diary.length) return '';
    const body = `<div class="magazine-feature-grid">${issue.diary.slice(0, 8).map((item, index) => `
      <article class="magazine-diary ${index === 0 ? 'lead' : ''}" ${item.url ? `data-mag-url="${esc(item.url)}"` : ''}>
        <div><span>${esc(shortDate(item.date))}</span><i>${esc(item.author || '')}</i></div>
        <h4>${esc(item.title || '一页日记')}</h4>
        <p>${esc(item.summary || '这一天被留了下来。')}</p>
        <footer>${[...(item.moods || []), ...(item.types || [])].slice(0, 3).map(tag => `<b>${esc(tag)}</b>`).join('')}</footer>
      </article>`).join('')}</div>`;
    return section('这个月写下来的', 'CHAPTER 01 · DIARY', body, issue.diary.length);
  }

  function renderNotes(issue) {
    if (!issue.notes.length) return '';
    const body = `<div class="magazine-note-wall">${issue.notes.slice(0, 10).map((item, index) => `<article style="--note-turn:${[-1.2, .8, -0.4, 1.1][index % 4]}deg"><small>${esc(shortDate(item.date))} · ${esc(item.author || '')}</small><p>${esc(item.content || '')}</p></article>`).join('')}</div>`;
    return section('散在桌上的小纸条', 'CHAPTER 02 · LITTLE NOTES', body, issue.notes.length);
  }

  function renderWords(issue) {
    const entries = [
      ...issue.letters.slice(0, 4).map(item => itemCard(item, '信', 'summary', `${shortDate(item.date)} · ${item.author || ''} → ${item.recipient || ''}`)),
      ...issue.quotes.slice(0, 5).map(item => `<blockquote class="magazine-quote" ${item.url ? `data-mag-url="${esc(item.url)}"` : ''}><span>“</span><p>${esc(item.quote || item.title || '')}</p><footer>${esc(item.starter || item.source || '我们')} · ${esc(shortDate(item.date))}</footer></blockquote>`)
    ].join('');
    return entries ? section('信和说过的话', 'CHAPTER 03 · WORDS', `<div class="magazine-words-grid">${entries}</div>`, issue.letters.length + issue.quotes.length) : '';
  }

  function renderArchive(issue) {
    const memories = issue.memories.slice().sort((a, b) => importanceNumber(b.importance) - importanceNumber(a.importance));
    const entries = [
      ...memories.slice(0, 6).map(item => itemCard(item, '记忆', 'text', `${shortDate(item.date)} · ${item.type || item.category || '记忆'}`)),
      ...issue.timeline.slice(0, 6).map(item => itemCard(item, '时间线', 'note', `${shortDate(item.date)} · ${item.type || '节点'}`))
    ].join('');
    return entries ? section('这个月被收进档案的', 'CHAPTER 04 · ARCHIVE', `<div class="magazine-archive-grid">${entries}</div>`, issue.memories.length + issue.timeline.length) : '';
  }

  function renderSongs(issue) {
    if (!issue.songs.length) return '';
    const body = `<ol class="magazine-playlist">${issue.songs.slice(0, 12).map((item, index) => `<li ${item.url ? `data-mag-url="${esc(item.url)}"` : ''}><span>${String(index + 1).padStart(2, '0')}</span><div><b>${esc(item.title || '一首歌')}</b><small>${esc(item.artist || item.recommender || '')}</small></div><em>${esc((item.moods || [])[0] || '♪')}</em></li>`).join('')}</ol>`;
    return section('那个月收进歌单', 'CHAPTER 05 · PLAYLIST', body, issue.songs.length);
  }

  function renderCurrentInsert(key, data) {
    if (key !== currentMonth()) return '';
    const photos = (data.albumImages || []).slice(0, 6);
    const paws = (data.pawprints || []).slice(-3).reverse();
    if (!photos.length && !paws.length) return '';
    const photoBody = photos.length ? `<div class="magazine-photo-strip">${photos.map(image => `<figure><img src="${esc(image.url)}" alt="${esc(image.caption || '小家相册夹页')}" loading="lazy"><figcaption>${esc(image.caption || '相册夹页')}</figcaption></figure>`).join('')}</div>` : '';
    const pawBody = paws.length ? `<div class="magazine-paw-margin">${paws.map(item => `<article><span>🐾</span><div><b>${esc(item.title || '一枚爪印')}</b><p>${esc(item.body || '')}</p></div></article>`).join('')}</div>` : '';
    return section('本期夹页', 'CURRENT INSERT · 未按日期归档', `${photoBody}${pawBody}<p class="magazine-honesty">照片与爪印目前没有可靠的月份字段，所以只放进正在装订的这一期；旧刊不会伪造它们的日期。</p>`, undefined);
  }

  function bindOpenables() {
    qsa('#magazineBook [data-mag-url]').forEach(node => {
      node.tabIndex = 0;
      node.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        location.href = node.dataset.magUrl;
      });
      node.addEventListener('keydown', event => {
        if (event.key === 'Enter') location.href = node.dataset.magUrl;
      });
    });
  }

  function renderMagazine() {
    if (!state.data) return;
    const months = collectMonths(state.data);
    if (!state.selected || !months.includes(state.selected)) state.selected = months[0] || currentMonth();
    renderShelf(months, state.data);

    const issue = issueData(state.data, state.selected);
    const keywords = keywordList(issue);
    const count = issueCount(issue);
    const host = qs('#magazineBook');
    if (!host) return;

    host.innerHTML = `
      <article class="magazine-cover">
        <div class="magazine-cover-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
        <header><span>KEATS HOME MONTHLY</span><b>VOL. ${volumeNumber(months, state.selected)}</b></header>
        <div class="magazine-cover-main">
          <small>${esc(statusText(state.selected))}</small>
          <h2>${esc(monthLabel(state.selected))}</h2>
          <p>${esc(keywords.length ? keywords.join(' / ') : '回家 / 灯光 / 一点点生活')}</p>
        </div>
        <footer><span>猫豹共同生活档案</span><span>${count} 条有日期的内容</span></footer>
      </article>

      <article class="magazine-editorial paper-card">
        <div><small>EDITOR'S NOTE</small><h3>这一册，自己从生活里长出来。</h3></div>
        <p>${esc(issueSummary(issue, state.selected))}</p>
        ${keywords.length ? `<div>${keywords.map(word => `<span>${esc(word)}</span>`).join('')}</div>` : ''}
      </article>

      <div class="magazine-pages">
        ${renderDiary(issue)}
        ${renderNotes(issue)}
        ${renderWords(issue)}
        ${renderArchive(issue)}
        ${renderSongs(issue)}
        ${renderCurrentInsert(state.selected, state.data)}
        ${count === 0 ? `<section class="magazine-empty paper-card"><span>☾</span><h3>这一册还没写满。</h3><p>等日记、纸条和小事慢慢落进来。</p></section>` : ''}
      </div>`;

    bindOpenables();
  }

  async function loadMagazine(force = false) {
    if (state.loading || (state.loaded && !force)) return;
    const shell = qs('#magazineBook');
    if (!shell) return;
    if (!sessionStorage.getItem(SESSION_KEY)) {
      shell.innerHTML = '<section class="magazine-locked paper-card"><span>⌂</span><h3>月刊还在书架里面。</h3><p>先用顶部的小家钥匙开门，我再把真实内容装订起来。</p></section>';
      return;
    }

    state.loading = true;
    shell.innerHTML = '<section class="magazine-loading paper-card"><span>✦</span><h3>编辑部正在捡纸页……</h3><p>日记、纸条、照片和记忆都在往这一册里走。</p></section>';
    try {
      const requests = {
        diary: '/api/diary?limit=100', letters: '/api/letters?limit=100', memories: '/api/memories?limit=100',
        timeline: '/api/timeline?limit=100', quotes: '/api/quotes?limit=100', songs: '/api/songs?limit=100',
        notes: '/api/notes?limit=100', pawprints: '/api/pawprints', album: `/api/page/${ALBUM_PAGE_ID}?kind=diary`
      };
      const entries = await Promise.allSettled(Object.entries(requests).map(async ([key, path]) => [key, await api(path)]));
      const data = { diary: [], letters: [], memories: [], timeline: [], quotes: [], songs: [], notes: [], pawprints: [], albumImages: [] };
      entries.forEach(result => {
        if (result.status !== 'fulfilled') return;
        const [key, payload] = result.value;
        if (key === 'album') data.albumImages = walkImages(payload.blocks || []);
        else data[key] = payload.items || [];
      });
      state.data = data;
      state.loaded = true;
      if (!state.selected) state.selected = currentMonth();
      renderMagazine();
    } catch (error) {
      shell.innerHTML = `<section class="magazine-locked paper-card"><span>☾</span><h3>这一册暂时没装起来。</h3><p>${esc(error.message || '等一会儿再来翻。')}</p></section>`;
    } finally {
      state.loading = false;
    }
  }

  function boot() {
    const view = qs('#view-magazine');
    if (!view) return;
    if (location.hash === '#magazine') loadMagazine();
    qsa('[data-view="magazine"]').forEach(button => {
      if (button.dataset.magazineBound === '1') return;
      button.dataset.magazineBound = '1';
      button.addEventListener('click', () => setTimeout(() => loadMagazine(), 80));
    });
  }

  window.addEventListener('pageshow', boot);
  window.addEventListener('hashchange', () => { if (location.hash === '#magazine') loadMagazine(); });
  setTimeout(boot, 520);

  let checks = 0;
  const tokenWaiter = setInterval(() => {
    checks += 1;
    if (sessionStorage.getItem(SESSION_KEY)) {
      clearInterval(tokenWaiter);
      if (location.hash === '#magazine') loadMagazine(true);
    } else if (checks >= 120) clearInterval(tokenWaiter);
  }, 1000);
})();
