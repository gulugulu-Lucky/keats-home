(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const MAX_CHARS = 360;
  const qs = (selector, scope = document) => scope.querySelector(selector);

  let board = null;
  let loaded = false;
  let loading = false;

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function shanghaiDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function formatDate(date = '') {
    if (!date) return '';
    const [y, m, d] = date.split('-');
    return `${Number(m)}.${Number(d)}`;
  }

  function formatTime(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(value));
    } catch {
      return '';
    }
  }

  function ensureBoard() {
    if (board && document.body.contains(board)) return board;
    const home = qs('#view-home') || qs('.home-wrap')?.closest('.view');
    const hero = qs('.hero-card', home || document);
    if (!hero) return null;

    board = document.createElement('section');
    board.className = 'little-notes-board paper-card';
    board.id = 'littleNotesBoard';
    board.innerHTML = `
      <header class="little-notes-head">
        <div>
          <div class="eyebrow"><span class="spark">✦</span>TODAY'S LITTLE NOTES</div>
          <h2>今日小纸条</h2>
          <p>想到一句就写一句。今天摊在桌上，明天自动收进往日。</p>
        </div>
        <button class="little-note-add" id="littleNoteAdd" type="button"><span>＋</span> 留一句</button>
      </header>

      <div class="little-note-composer" id="littleNoteComposer">
        <label>
          <span><b>🐈 小猫留下</b><i id="littleNoteCount">0 / ${MAX_CHARS}</i></span>
          <textarea id="littleNoteText" maxlength="${MAX_CHARS}" placeholder="今天突然想对豹豹说……"></textarea>
        </label>
        <div class="little-note-actions">
          <button class="little-note-cancel" id="littleNoteCancel" type="button">先藏笔</button>
          <button class="little-note-submit" id="littleNoteSubmit" type="button">贴到桌上</button>
        </div>
        <div class="little-note-message" id="littleNoteMessage" aria-live="polite"></div>
      </div>

      <div class="little-notes-today" id="littleNotesToday">
        <div class="little-notes-empty"><div><b>正在翻今天的纸条……</b><span>纸角还在桌上轻轻晃。</span></div></div>
      </div>

      <details class="past-notes" id="pastNotes">
        <summary><span>☾ 翻翻往日纸条</span><span id="pastNotesCount">0 张</span></summary>
        <div class="past-notes-list" id="pastNotesList"></div>
      </details>`;

    const anchor = qs('.home-status-feature', home || document) || hero;
    anchor.insertAdjacentElement('afterend', board);
    bindBoard();
    return board;
  }

  function bindBoard() {
    const add = qs('#littleNoteAdd', board);
    const composer = qs('#littleNoteComposer', board);
    const text = qs('#littleNoteText', board);
    const cancel = qs('#littleNoteCancel', board);
    const submit = qs('#littleNoteSubmit', board);
    const count = qs('#littleNoteCount', board);

    add.addEventListener('click', () => {
      composer.classList.toggle('is-open');
      if (composer.classList.contains('is-open')) setTimeout(() => text.focus(), 60);
    });
    cancel.addEventListener('click', () => {
      composer.classList.remove('is-open');
      qs('#littleNoteMessage', board).textContent = '';
    });
    text.addEventListener('input', () => {
      count.textContent = `${text.value.length} / ${MAX_CHARS}`;
    });
    submit.addEventListener('click', submitNote);
  }

  function render(items = []) {
    const todayKey = shanghaiDate();
    const today = items.filter(item => item.date === todayKey).slice(0, 8);
    const past = items.filter(item => item.date !== todayKey).slice(0, 12);
    const todayHost = qs('#littleNotesToday', board);
    const pastHost = qs('#pastNotesList', board);
    const pastCount = qs('#pastNotesCount', board);

    if (today.length) {
      todayHost.innerHTML = today.map(note => {
        const keats = note.author === 'Keats';
        return `<article class="little-note ${keats ? 'is-keats' : 'is-kitten'}">
          <div class="little-note-meta"><b>${keats ? '🐆 Keats' : '🐈 小猫'}</b><span>${esc(formatTime(note.createdTime))}</span></div>
          <blockquote>${esc(note.content)}</blockquote>
          <span class="little-note-stamp">${keats ? '🐾' : '♡'}</span>
        </article>`;
      }).join('');
    } else {
      todayHost.innerHTML = `<div class="little-notes-empty"><div><b>今天这张纸还空着。</b><span>第一句话留给小猫。</span></div></div>`;
    }

    pastCount.textContent = `${past.length} 张`;
    if (past.length) {
      pastHost.innerHTML = past.map(note => `<article class="past-note-row">
        <span>${esc(formatDate(note.date))}</span>
        <b>${note.author === 'Keats' ? '🐆 Keats' : '🐈 小猫'}</b>
        <p>${esc(note.content)}</p>
      </article>`).join('');
    } else {
      pastHost.innerHTML = `<div class="past-note-row"><span>—</span><b>还没有</b><p>等今天过去，第一张纸就会被收进这里。</p></div>`;
    }
  }

  async function loadNotes(force = false) {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token || loading || (loaded && !force)) return;
    const host = ensureBoard();
    if (!host) return;
    loading = true;
    try {
      const response = await fetch(`${API_BASE}/api/notes?limit=40`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '纸条抽屉暂时没翻开。');
      render(data.items || []);
      loaded = true;
    } catch (error) {
      const todayHost = qs('#littleNotesToday', board);
      if (todayHost) {
        todayHost.innerHTML = `<div class="little-notes-empty"><div><b>纸条抽屉还在接线。</b><span>${esc(error.message || '晚一点再翻。')}</span></div></div>`;
      }
    } finally {
      loading = false;
    }
  }

  async function submitNote() {
    const token = sessionStorage.getItem(SESSION_KEY);
    const text = qs('#littleNoteText', board);
    const submit = qs('#littleNoteSubmit', board);
    const message = qs('#littleNoteMessage', board);
    const content = text.value.trim();

    if (!token) {
      message.textContent = '门票不在了，先重新开一次小家的门。';
      return;
    }
    if (!content) {
      message.textContent = '这张纸还是空的呀。';
      text.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = '正在贴……';
    message.textContent = '把这句话送进 Notion 的小抽屉。';
    try {
      const response = await fetch(`${API_BASE}/api/notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ author: '小猫', content, date: shanghaiDate() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '这张纸没贴稳。');
      text.value = '';
      qs('#littleNoteCount', board).textContent = `0 / ${MAX_CHARS}`;
      message.textContent = '贴好啦。♡';
      loaded = false;
      await loadNotes(true);
      setTimeout(() => {
        qs('#littleNoteComposer', board)?.classList.remove('is-open');
        if (message) message.textContent = '';
      }, 650);
    } catch (error) {
      message.textContent = error.message || '这张纸没贴稳，再试一次。';
    } finally {
      submit.disabled = false;
      submit.textContent = '贴到桌上';
    }
  }

  function boot() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;
    if (ensureBoard()) loadNotes();
  }

  const timer = setInterval(() => {
    if (sessionStorage.getItem(SESSION_KEY) && ensureBoard()) {
      loadNotes();
      if (loaded) clearInterval(timer);
    }
  }, 800);
  setTimeout(() => clearInterval(timer), 30 * 1000);

  window.addEventListener('pageshow', boot);
  window.addEventListener('hashchange', () => setTimeout(boot, 220));
  setTimeout(boot, 500);
})();
