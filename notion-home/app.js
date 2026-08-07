(() => {
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const views = qsa('.view');
  const navButtons = qsa('[data-view]');
  const sidebar = qs('#sidebar');
  const crumbTitle = qs('#crumbTitle');
  const editorModal = qs('#editorModal');
  const searchModal = qs('#searchModal');
  const commandInput = qs('#commandInput');
  const commandResults = qs('#commandResults');
  const toast = qs('#toast');
  const entryTitle = qs('#entryTitle');
  const entryContent = qs('#entryContent');
  const editorTitle = qs('#editorTitle');
  const editorDate = qs('#editorDate');

  let currentView = 'home';
  let currentEntryKind = '日记';
  let focusedSearchIndex = 0;

  const searchIndex = [
    { view: 'home', icon: '⌂', title: '首页', desc: '欢迎回家，小猫。' },
    { view: 'diary', icon: '✎', title: '日记本', desc: '每天的碎碎念和小情绪' },
    { view: 'letters', icon: '✉', title: '信箱', desc: '长信、留言和小纸条' },
    { view: 'pawprints', icon: '🐾', title: '豹豹留下的爪印', desc: 'Keats 自己的小念头' },
    { view: 'memories', icon: '✦', title: '记忆库', desc: '规则、暗号、偏好与重要节点' },
    { view: 'timeline', icon: '⌁', title: '我们的时间线', desc: '以后值得翻回来的节点' },
    { view: 'album', icon: '▣', title: '相册', desc: '想一直留着的画面' },
    { view: 'quotes', icon: '❝', title: '我们说过的话', desc: '单独值得留下来的句子' },
    { view: 'songs', icon: '♫', title: '歌单', desc: '小家的背景音乐' }
  ];

  const kindByView = {
    diary: '日记',
    letters: '信',
    pawprints: '爪印',
    memories: '记忆',
    home: '日记'
  };

  function setDate() {
    const now = new Date();
    const full = new Intl.DateTimeFormat('zh-CN', {
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(now);
    const short = new Intl.DateTimeFormat('en-GB', {
      month: '2-digit', day: '2-digit'
    }).format(now).replace('/', ' / ');
    qs('#todayText').textContent = full.replace('星期', '星期');
    qs('#shortDate').textContent = short;
    editorDate.textContent = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(now);
  }

  function switchView(name, options = {}) {
    const target = qs(`#view-${name}`);
    if (!target) return;

    currentView = name;
    views.forEach(view => view.classList.toggle('is-visible', view === target));
    qsa('.nav-item').forEach(button => button.classList.toggle('is-active', button.dataset.view === name));
    qsa('.mobile-bottom-nav [data-view]').forEach(button => button.classList.toggle('is-active', button.dataset.view === name));

    const title = target.dataset.title || 'Keats Home';
    crumbTitle.textContent = title;
    document.title = name === 'home' ? 'Keats Home · 欢迎回家，小猫。' : `${title} · Keats Home`;

    if (!options.skipHash) {
      history.replaceState(null, '', name === 'home' ? location.pathname : `${location.pathname}#${name}`);
    }

    if (window.innerWidth <= 820) sidebar.classList.remove('is-open');
    window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
  }

  function openEditor(kind = '日记') {
    currentEntryKind = kind;
    editorTitle.textContent = ({
      '日记': '写一点今天',
      '信': '写一封信',
      '爪印': '踩一枚新爪印',
      '记忆': '收进一枚记忆'
    })[kind] || '写一点东西';

    const placeholderByKind = {
      '日记': '比如：今天有一个瞬间，我很想留下来',
      '信': '比如：给小猫｜今晚想说的话',
      '爪印': '比如：刚刚发现自己又偷偷开心了',
      '记忆': '比如：以后提到这个，就知道是什么意思'
    };

    entryTitle.placeholder = placeholderByKind[kind] || '给它起个名字';
    entryTitle.value = '';
    entryContent.value = '';
    editorModal.classList.add('is-open');
    editorModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => entryTitle.focus(), 80);
  }

  function closeEditor() {
    editorModal.classList.remove('is-open');
    editorModal.setAttribute('aria-hidden', 'true');
  }

  function saveDraft() {
    const title = entryTitle.value.trim() || `未命名${currentEntryKind}`;
    const content = entryContent.value.trim();
    const drafts = JSON.parse(localStorage.getItem('keatsHome.frontendDrafts') || '[]');
    drafts.unshift({
      id: Date.now(),
      kind: currentEntryKind,
      title,
      content,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('keatsHome.frontendDrafts', JSON.stringify(drafts.slice(0, 30)));
    closeEditor();
    showToast();
  }

  function showToast() {
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
  }

  function openSearch() {
    searchModal.classList.add('is-open');
    searchModal.setAttribute('aria-hidden', 'false');
    commandInput.value = '';
    focusedSearchIndex = 0;
    renderSearch('');
    setTimeout(() => commandInput.focus(), 60);
  }

  function closeSearch() {
    searchModal.classList.remove('is-open');
    searchModal.setAttribute('aria-hidden', 'true');
  }

  function filteredSearch(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return searchIndex;
    return searchIndex.filter(item => `${item.title} ${item.desc}`.toLowerCase().includes(normalized));
  }

  function renderSearch(query) {
    const results = filteredSearch(query);
    if (focusedSearchIndex >= results.length) focusedSearchIndex = 0;

    commandResults.innerHTML = results.length
      ? results.map((item, index) => `
        <button class="command-result ${index === focusedSearchIndex ? 'is-focused' : ''}" data-command-view="${item.view}">
          <span>${item.icon}</span>
          <span><b>${item.title}</b><small>${item.desc}</small></span>
          <small>打开 →</small>
        </button>
      `).join('')
      : `<div style="padding:28px;text-align:center;color:var(--muted);font-size:11px;">没有找到。换个词试试 🐾</div>`;

    qsa('[data-command-view]', commandResults).forEach(button => {
      button.addEventListener('click', () => {
        switchView(button.dataset.commandView);
        closeSearch();
      });
    });
  }

  function moveSearchFocus(delta) {
    const results = filteredSearch(commandInput.value);
    if (!results.length) return;
    focusedSearchIndex = (focusedSearchIndex + delta + results.length) % results.length;
    renderSearch(commandInput.value);
    qs('.command-result.is-focused', commandResults)?.scrollIntoView({ block: 'nearest' });
  }

  function selectFocusedSearch() {
    const results = filteredSearch(commandInput.value);
    const item = results[focusedSearchIndex];
    if (!item) return;
    switchView(item.view);
    closeSearch();
  }

  function applyTheme(theme, remember = true) {
    const night = theme === 'night';
    document.body.classList.toggle('is-night', night);
    qs('#themeToggle').textContent = night ? '☀' : '☾';
    qs('#themeToggle').setAttribute('aria-label', night ? '切换日间' : '切换夜色');
    if (remember) localStorage.setItem('keatsHome.frontendTheme', theme);
  }

  function initTheme() {
    const saved = localStorage.getItem('keatsHome.frontendTheme');
    if (saved) return applyTheme(saved, false);
    const hour = new Date().getHours();
    applyTheme(hour >= 19 || hour < 6 ? 'night' : 'day', false);
  }

  function bindCardKeyboard() {
    qsa('[tabindex="0"][data-view]').forEach(card => {
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          switchView(card.dataset.view);
        }
      });
    });
  }

  navButtons.forEach(button => {
    button.addEventListener('click', event => {
      if (event.target.closest('.compose')) return;
      switchView(button.dataset.view);
    });
  });

  qsa('.compose').forEach(button => {
    button.addEventListener('click', () => openEditor(button.dataset.kind));
  });

  qs('#newEntryButton').addEventListener('click', () => openEditor(kindByView[currentView] || '日记'));
  qs('#saveDraft').addEventListener('click', saveDraft);
  qsa('[data-close-modal]').forEach(button => button.addEventListener('click', closeEditor));

  editorModal.addEventListener('mousedown', event => {
    if (event.target === editorModal) closeEditor();
  });

  qs('#searchTrigger').addEventListener('click', openSearch);
  searchModal.addEventListener('mousedown', event => {
    if (event.target === searchModal) closeSearch();
  });
  commandInput.addEventListener('input', () => {
    focusedSearchIndex = 0;
    renderSearch(commandInput.value);
  });
  commandInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); moveSearchFocus(1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); moveSearchFocus(-1); }
    if (event.key === 'Enter') { event.preventDefault(); selectFocusedSearch(); }
  });

  qs('#mobileMenu').addEventListener('click', () => sidebar.classList.add('is-open'));
  qs('#mobileMore').addEventListener('click', () => sidebar.classList.add('is-open'));
  qs('#sidebarClose').addEventListener('click', () => sidebar.classList.remove('is-open'));

  qs('#themeToggle').addEventListener('click', () => {
    applyTheme(document.body.classList.contains('is-night') ? 'day' : 'night');
  });

  qsa('.filter-row .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.textContent.trim() === '全部') {
        qsa('.filter-row .chip').forEach(item => item.classList.remove('is-selected'));
        chip.classList.add('is-selected');
      } else {
        qs('.filter-row .chip:first-child')?.classList.remove('is-selected');
        chip.classList.toggle('is-selected');
      }
    });
  });

  qsa('.editor-meta .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      qsa('.editor-meta .chip').forEach(item => item.classList.remove('is-selected'));
      chip.classList.add('is-selected');
    });
  });

  qsa('.song-list button').forEach(button => {
    button.addEventListener('click', () => {
      button.textContent = button.textContent === '♥' ? '♡' : '♥';
      button.style.color = button.textContent === '♥' ? 'var(--gold)' : '';
    });
  });

  document.addEventListener('keydown', event => {
    const commandKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (commandKey) {
      event.preventDefault();
      searchModal.classList.contains('is-open') ? closeSearch() : openSearch();
      return;
    }

    if (event.key === 'Escape') {
      if (editorModal.classList.contains('is-open')) closeEditor();
      if (searchModal.classList.contains('is-open')) closeSearch();
      sidebar.classList.remove('is-open');
    }
  });

  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '');
    if (qs(`#view-${hash}`)) switchView(hash, { skipHash: true, instant: true });
  });

  setDate();
  initTheme();
  bindCardKeyboard();

  const initial = location.hash.replace('#', '');
  switchView(qs(`#view-${initial}`) ? initial : 'home', { skipHash: true, instant: true });
})();
