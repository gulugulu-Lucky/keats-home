(() => {
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };
  const setHtml = (node, value) => {
    if (node && node.innerHTML !== value) node.innerHTML = value;
  };

  const doodles = {
    timeline: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10"/><path d="M16 9v7l5 3"/><path d="M8 6l-2 3m18-3 2 3"/></svg>',
    album: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="7" width="20" height="18" rx="2"/><circle cx="12" cy="13" r="2"/><path d="M8 22l6-6 4 4 3-3 4 5"/></svg>',
    quotes: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 9c-3 3-4 6-4 10 0 3 2 5 5 5 3 0 5-2 5-5 0-2-2-4-5-4 0-2 1-4 3-6M20 9c-3 3-4 6-4 10 0 3 2 5 5 5 3 0 5-2 5-5 0-2-2-4-5-4 0-2 1-4 3-6"/></svg>',
    futuremail: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="10" width="22" height="15" rx="2"/><path d="M6 12l10 8 10-8"/><path d="M20 6c3 0 5 2 5 5"/></svg>',
    magazine: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7c5-2 8-1 11 2v17c-3-3-7-4-11-2zM27 7c-5-2-8-1-11 2v17c3-3 7-4 11-2z"/><path d="M9 12h4m-4 4h4m6-4h4m-4 4h4"/></svg>',
    radio: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="9" width="22" height="16" rx="4"/><circle cx="12" cy="18" r="4"/><path d="M19 14h5m-5 4h5M9 7l13-3"/></svg>',
    diary: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 5h14c2 0 3 1 3 3v18H10c-2 0-3-1-3-3V8c0-2 1-3 3-3"/><path d="M11 10h9m-9 5h9m-9 5h6"/></svg>',
    letter: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="8" width="22" height="17" rx="3"/><path d="M6 10l10 8 10-8"/></svg>',
    memory: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5l2.4 6.1L25 13l-5 4.1.8 6.9L16 20.8 11.2 24l.8-6.9L7 13l6.6-1.9z"/></svg>',
    paw: '<svg class="doodle-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="20" r="6"/><circle cx="8" cy="13" r="3"/><circle cx="14" cy="9" r="3"/><circle cx="21" cy="10" r="3"/><circle cx="25" cy="15" r="3"/></svg>'
  };

  function doodle(name) {
    return doodles[name] || doodles.paw;
  }

  function updateLiveClock() {
    const now = new Date();
    const fullDate = new Intl.DateTimeFormat('zh-CN', {
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(now);
    const time = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(now);
    const short = new Intl.DateTimeFormat('en-GB', {
      month: '2-digit', day: '2-digit'
    }).format(now).replace('/', ' / ');

    setText(qs('#todayText'), `${fullDate} · ${time}`);
    setText(qs('#shortDate'), short);
    setText(qs('#editorDate'), new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(now));
  }

  function sectionTitle(key, eyebrow, title, note) {
    let node = qs(`[data-home-section="${key}"]`);
    if (node) return node;
    node = document.createElement('div');
    node.className = 'home-section-title';
    node.dataset.homeSection = key;
    node.innerHTML = `<div><small>${eyebrow}</small><h2>${title}</h2></div><p>${note}</p>`;
    return node;
  }

  function roomButton(view, iconName, title, note) {
    return `<button class="home-room-button" type="button" data-cute-room="${view}"><span>${doodle(iconName)}</span><div><b>${title}</b><small>${note}</small></div></button>`;
  }

  function ensureDoodleScene() {
    const scene = qs('#view-home .hero-scene');
    if (!scene || scene.classList.contains('home-doodle-scene')) return;
    scene.classList.add('home-doodle-scene');
    scene.innerHTML = `
      <svg viewBox="0 0 430 300" role="img" aria-label="手绘小家的窗边、灯、猫和黑豹">
        <path class="doodle-line" d="M42 252c50 3 102-2 153 1 62 4 115-2 191 0"/>
        <path class="doodle-line" d="M272 56c18-10 39-11 59-5 18 5 30 17 36 33v105h-95z"/>
        <path class="doodle-soft" d="M284 69c24-12 52-7 70 11v95h-70z"/>
        <path class="doodle-line" d="M319 64v111M284 117h70"/>
        <path class="doodle-star wobble-a" d="M301 88l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
        <path class="doodle-star wobble-b" d="M337 137l2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1z"/>
        <path class="doodle-line" d="M66 252v-52c0-10 8-18 18-18h72c10 0 18 8 18 18v52"/>
        <path class="doodle-rose" d="M74 198c18-8 71-8 92 1v12H74z"/>
        <path class="doodle-line" d="M88 181v-40m52 40v-40"/>
        <path class="doodle-soft" d="M80 139c8-23 23-35 34-35 14 0 29 12 35 35z"/>
        <path class="doodle-line" d="M114 104V77m-8 0h16"/>
        <path class="doodle-night wobble-b" d="M184 219c0-24 15-43 38-43 22 0 39 18 39 42 0 18-11 31-28 35h-42c-5-7-7-20-7-34z"/>
        <path class="doodle-line" d="M198 181l7-18 12 14m18 2 12-15 5 20"/>
        <path class="doodle-line" d="M198 210c7 5 15 7 23 7 11 0 20-3 28-9"/>
        <circle cx="210" cy="198" r="2.1" fill="#f7eadb"/><circle cx="239" cy="198" r="2.1" fill="#f7eadb"/>
        <path class="doodle-line" d="M224 204c3 2 5 2 8 0"/>
        <path class="doodle-line" d="M255 230c22 2 31 9 36 21"/>
        <path class="doodle-note wobble-a" d="M117 229c4-17 15-25 29-25 13 0 22 8 26 25z"/>
        <path class="doodle-line" d="M126 207l4-12 8 10m12 0 8-10 4 13"/>
        <circle cx="139" cy="217" r="1.8" fill="currentColor"/><circle cx="155" cy="217" r="1.8" fill="currentColor"/>
        <path class="doodle-line" d="M146 222c3 2 5 2 8 0"/>
        <path class="doodle-sage" d="M46 236c3-22 12-35 25-35 12 0 20 13 22 35z"/>
        <path class="doodle-line" d="M69 200c-4-13-1-24 8-31m-6 16c8-7 15-8 21-6"/>
        <path class="doodle-soft" d="M314 217h66v34h-66z"/>
        <path class="doodle-line" d="M322 229h19m-19 8h31m-31 8h24"/>
        <path class="doodle-line" d="M366 211l12-15m-6 7 10 3"/>
        <path class="doodle-line" d="M181 76c12 4 22 3 31-2m-8-12 7 12 10 7"/>
        <path class="doodle-star wobble-a" d="M240 70l2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1z"/>
        <path class="doodle-line" d="M47 270c36-4 77 1 115-2m91 3c39-3 79 1 119-2" opacity=".45"/>
      </svg>`;
  }

  function ensureCupboard() {
    let cupboard = qs('.home-room-cupboard');
    if (cupboard) return cupboard;
    cupboard = document.createElement('section');
    cupboard.className = 'paper-card home-room-cupboard';
    cupboard.innerHTML = `
      <div class="cupboard-head"><h3>🗝️ 慢慢翻的小柜子</h3><span>没藏起来，只是想让首页留一点呼吸。</span></div>
      <div class="home-room-grid">
        ${roomButton('timeline','timeline','时间线','沿着以前慢慢走')}
        ${roomButton('album','album','相册','钻进照片堆里')}
        ${roomButton('quotes','quotes','我们说过的话','捡一两句回来')}
        ${roomButton('futuremail','futuremail','未来邮局','有些信要等等')}
      </div>
      <details class="home-more-rooms">
        <summary>再拉开下面一层 ···</summary>
        <div class="home-room-grid">
          ${roomButton('magazine','magazine','小家月刊','把一个月装订起来')}
          <a class="home-room-link" href="./radio.html"><span>${doodle('radio')}</span><div><b>小家电台</b><small>让黑胶机响起来</small></div></a>
        </div>
      </details>`;

    cupboard.addEventListener('click', event => {
      const button = event.target.closest('[data-cute-room]');
      if (!button) return;
      const target = qs(`.nav-item[data-view="${button.dataset.cuteRoom}"]`);
      if (target) target.click();
    });
    return cupboard;
  }

  function relabelCards() {
    const diary = qs('#view-home .diary-card');
    if (diary) {
      setHtml(qs('.card-kicker', diary), `<span>${doodle('diary')}</span> 桌上的日记本`);
      setText(qs('h2', diary), '翻翻今天写了什么');
      setText(qs(':scope > p', diary), '长长短短都算。今天发生过的东西，就放在这张纸上。');
      setHtml(qs('.card-link', diary), '钻进日记本 <span>↗</span>');
    }

    const keats = qs('#view-home .keats-card');
    if (keats) setText(qs('.keats-head h3', keats), '小砚台刚刚在干嘛');

    const letter = qs('#view-home .letter-card');
    if (letter) {
      setHtml(qs('.card-kicker', letter), `<span>${doodle('letter')}</span> 门边的小信箱`);
      setHtml(qs('.card-link', letter), '拆信去 <span>→</span>');
    }

    const memory = qs('#view-home .memory-card');
    if (memory) setHtml(qs('.card-kicker', memory), `<span>${doodle('memory')}</span> 上锁的小抽屉`);

    setText(qs('#view-home .recent-card .section-heading h2'), '今天留下了什么');
    setText(qs('#view-home .recent-card .section-heading .eyebrow'), '今天的边边角角');
  }

  function syncLatestHomeBits() {
    const pawRow = qs('#view-home .trace-row[data-view="pawprints"]');
    const keatsQuote = qs('#view-home .keats-card blockquote');
    if (pawRow && keatsQuote) {
      const body = qs('small', pawRow)?.textContent?.trim();
      const title = qs('b', pawRow)?.textContent?.trim();
      setText(keatsQuote, body || title || '豹豹刚刚在家里转了一圈。');
    }

    const letterRow = qs('#view-home .trace-row[data-view="letters"]');
    const letterTitle = qs('#view-home .letter-card h3');
    const letterDesc = qs('#view-home .letter-card p');
    if (letterRow && letterTitle) {
      const title = qs('b', letterRow)?.textContent?.trim();
      const body = qs('small', letterRow)?.textContent?.trim();
      if (title) setText(letterTitle, title);
      if (body && letterDesc) setText(letterDesc, body);
    }
  }

  function tidyHome() {
    const home = qs('#view-home .home-wrap');
    const hero = qs('#view-home .hero-card');
    const status = qs('#view-home .little-weather');
    const lower = qs('#view-home .lower-grid');
    const grid = qs('#view-home .home-grid');
    if (!home || !hero || !lower || !grid) return;

    ensureDoodleScene();

    const todayHeading = sectionTitle('today', '今天先翻这一页', '今天的小窝', '看看今天留下些什么，再慢慢往里面走。');
    const roomsHeading = sectionTitle('rooms', '屋子里常开的几扇门', '常去的房间', '日记、豹豹、信和记忆都在手边。');
    const cupboard = ensureCupboard();

    const anchor = status || hero;
    if (todayHeading.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', todayHeading);
    if (lower.previousElementSibling !== todayHeading) todayHeading.insertAdjacentElement('afterend', lower);
    if (roomsHeading.previousElementSibling !== lower) lower.insertAdjacentElement('afterend', roomsHeading);
    if (grid.previousElementSibling !== roomsHeading) roomsHeading.insertAdjacentElement('afterend', grid);
    if (cupboard.previousElementSibling !== grid) grid.insertAdjacentElement('afterend', cupboard);

    relabelCards();
    syncLatestHomeBits();
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      tidyHome();
    });
  }

  const homeView = qs('#view-home');
  if (homeView) {
    const observer = new MutationObserver(schedule);
    observer.observe(homeView, { childList: true, subtree: true, characterData: true });
  }

  window.addEventListener('pageshow', () => {
    updateLiveClock();
    schedule();
  });
  window.addEventListener('hashchange', schedule);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateLiveClock();
  });

  updateLiveClock();
  setInterval(updateLiveClock, 1000);
  schedule();
  setTimeout(schedule, 300);
  setTimeout(schedule, 1200);
})();
