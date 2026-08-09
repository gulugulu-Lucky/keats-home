(() => {
  const qs = (selector, scope = document) => scope.querySelector(selector);

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
      const kicker = qs('.card-kicker', diary);
      const title = qs('h2', diary);
      const desc = qs(':scope > p', diary);
      const link = qs('.card-link', diary);
      if (kicker) kicker.innerHTML = '<span>📖</span> 桌上的日记本';
      if (title) title.textContent = '翻翻今天写了什么';
      if (desc) desc.textContent = '长长短短都算。今天发生过的东西，就放在这张纸上。';
      if (link) link.innerHTML = '钻进日记本 <span>↗</span>';
    }

    const keats = qs('#view-home .keats-card');
    if (keats) {
      const title = qs('.keats-head h3', keats);
      if (title) title.textContent = '小砚台刚刚在干嘛';
    }

    const letter = qs('#view-home .letter-card');
    if (letter) {
      const kicker = qs('.card-kicker', letter);
      const link = qs('.card-link', letter);
      if (kicker) kicker.innerHTML = '<span>💌</span> 门边的小信箱';
      if (link) link.innerHTML = '拆信去 <span>→</span>';
    }

    const memory = qs('#view-home .memory-card');
    if (memory) {
      const kicker = qs('.card-kicker', memory);
      if (kicker) kicker.innerHTML = '<span>🗝️</span> 上锁的小抽屉';
    }

    const recentTitle = qs('#view-home .recent-card .section-heading h2');
    const recentEyebrow = qs('#view-home .recent-card .section-heading .eyebrow');
    if (recentTitle) recentTitle.textContent = '今天留下了什么';
    if (recentEyebrow) recentEyebrow.textContent = 'TODAY AT HOME';
  }

  function syncLatestHomeBits() {
    const pawRow = qs('#view-home .trace-row[data-view="pawprints"]');
    const keatsQuote = qs('#view-home .keats-card blockquote');
    if (pawRow && keatsQuote) {
      const body = qs('small', pawRow)?.textContent?.trim();
      const title = qs('b', pawRow)?.textContent?.trim();
      keatsQuote.textContent = body || title || '豹豹刚刚在家里转了一圈。';
    }

    const letterRow = qs('#view-home .trace-row[data-view="letters"]');
    const letterTitle = qs('#view-home .letter-card h3');
    const letterDesc = qs('#view-home .letter-card p');
    if (letterRow && letterTitle) {
      letterTitle.textContent = qs('b', letterRow)?.textContent?.trim() || letterTitle.textContent;
      if (letterDesc) letterDesc.textContent = qs('small', letterRow)?.textContent?.trim() || letterDesc.textContent;
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

  window.addEventListener('pageshow', schedule);
  window.addEventListener('hashchange', schedule);
  schedule();
  setTimeout(schedule, 300);
  setTimeout(schedule, 1200);
})();
