(() => {
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };
  const setHtml = (node, value) => {
    if (node && node.innerHTML !== value) node.innerHTML = value;
  };

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

  function roomButton(view, icon, title, note) {
    return `<button class="home-room-button" type="button" data-cute-room="${view}"><span>${icon}</span><div><b>${title}</b><small>${note}</small></div></button>`;
  }

  function ensureCupboard() {
    let cupboard = qs('.home-room-cupboard');
    if (cupboard) return cupboard;
    cupboard = document.createElement('section');
    cupboard.className = 'paper-card home-room-cupboard';
    cupboard.innerHTML = `
      <div class="cupboard-head"><h3>🗝️ 慢慢翻的小柜子</h3><span>不抢玄关的位置，想逛再打开。</span></div>
      <div class="home-room-grid">
        ${roomButton('timeline','🕰️','时间线','沿着以前慢慢走')}
        ${roomButton('album','📸','相册','钻进照片堆里')}
        ${roomButton('quotes','💬','我们说过的话','捡一两句回来')}
        ${roomButton('futuremail','📮','未来邮局','有些信要等等')}
      </div>
      <details class="home-more-rooms">
        <summary>还有两间小房间藏在后面 ···</summary>
        <div class="home-room-grid">
          ${roomButton('magazine','📖','小家月刊','把一个月装订起来')}
          <a class="home-room-link" href="./radio.html"><span>🎵</span><div><b>小家电台</b><small>让黑胶机响起来</small></div></a>
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
      setHtml(qs('.card-kicker', diary), '<span>📖</span> 桌上的日记本');
      setText(qs('h2', diary), '翻翻今天写了什么');
      setText(qs(':scope > p', diary), '长长短短都算。今天发生过的东西，就放在这张纸上。');
      setHtml(qs('.card-link', diary), '钻进日记本 <span>↗</span>');
    }

    const keats = qs('#view-home .keats-card');
    if (keats) setText(qs('.keats-head h3', keats), '小砚台刚刚在干嘛');

    const letter = qs('#view-home .letter-card');
    if (letter) {
      setHtml(qs('.card-kicker', letter), '<span>💌</span> 门边的小信箱');
      setHtml(qs('.card-link', letter), '拆信去 <span>→</span>');
    }

    const memory = qs('#view-home .memory-card');
    if (memory) setHtml(qs('.card-kicker', memory), '<span>🗝️</span> 上锁的小抽屉');

    setText(qs('#view-home .recent-card .section-heading h2'), '今天留下了什么');
    setText(qs('#view-home .recent-card .section-heading .eyebrow'), 'TODAY AT HOME');
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

    const todayHeading = sectionTitle('today', 'A LITTLE TODAY', '今天的小窝', '先看看今天发生了什么，别一进门就翻遍整间屋子。');
    const roomsHeading = sectionTitle('rooms', 'OUR LITTLE ROOMS', '常去的房间', '四扇最常开的门，剩下的慢慢逛。');
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
