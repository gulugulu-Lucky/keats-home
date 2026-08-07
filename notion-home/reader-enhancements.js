(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const params = new URLSearchParams(location.search);
  const pageId = params.get('id') || '';
  const kind = params.get('kind') || 'diary';
  const fallbackTitle = params.get('title') || '';

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function repairTitle() {
    if (!fallbackTitle) return;
    const title = document.querySelector('#pageTitle');
    if (title && (!title.textContent.trim() || title.textContent.trim() === '这一页')) {
      title.textContent = fallbackTitle;
      document.title = `${fallbackTitle} · Keats Home`;
    }
  }

  function renderState(item) {
    if (kind !== 'diary' || !item || document.querySelector('.diary-state-panel')) return;
    const tagsHost = document.querySelector('#pageTags');
    if (!tagsHost) return;

    const cats = item.catStates?.length ? item.catStates : [item.catState].filter(Boolean);
    const energy = Number.isFinite(Number(item.energy)) ? Math.max(0, Math.min(100, Number(item.energy))) : null;
    const panel = document.createElement('section');
    panel.className = 'diary-state-panel';
    panel.innerHTML = `
      <div class="diary-state-title"><b>今天的双猫状态</b><small>NOTION LITTLE DETAILS</small></div>
      <div class="diary-state-grid">
        <div class="diary-state-cell"><span>🐈 小猫</span><strong>${esc(item.catState || cats[0] || '今天也在家')}</strong></div>
        <div class="diary-state-cell"><span>🐆 Keats</span><strong>${esc(item.keatsState || '守灯版')}</strong></div>
      </div>
      ${cats.length ? `<div class="diary-state-chips">${cats.map(tag => `<i>${esc(tag)}</i>`).join('')}</div>` : ''}
      ${energy !== null ? `<div class="diary-energy"><span>今日能量</span><div class="diary-energy-track"><div class="diary-energy-fill" style="width:${energy}%"></div></div><b>${energy}</b></div>` : ''}
      <div class="diary-state-chips"><i>${item.inMemory ? '✦ 已放进记忆库' : '☾ 这一页先留在日记本'}</i></div>`;
    tagsHost.insertAdjacentElement('afterend', panel);
  }

  async function loadExtras() {
    repairTitle();
    if (!pageId || kind !== 'diary') return;
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/page/${encodeURIComponent(pageId)}?kind=diary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) renderState(data.item || {});
    } catch (error) {
      console.warn('Diary detail panel skipped:', error);
    }
  }

  const observer = new MutationObserver(() => repairTitle());
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  setTimeout(() => observer.disconnect(), 8000);
  setTimeout(loadExtras, 500);
})();