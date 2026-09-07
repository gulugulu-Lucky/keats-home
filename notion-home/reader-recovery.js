(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const params = new URLSearchParams(location.search);
  const pageId = params.get('id') || '';
  const kind = params.get('kind') || 'diary';

  const esc = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function rich(runs = []) {
    return runs.map(run => {
      let text = esc(run.text || '').replace(/\n/g, '<br>');
      const a = run.annotations || {};
      if (a.code) text = `<code>${text}</code>`;
      if (a.bold) text = `<strong>${text}</strong>`;
      if (a.italic) text = `<em>${text}</em>`;
      if (a.strikethrough) text = `<s>${text}</s>`;
      if (a.underline) text = `<u>${text}</u>`;
      if (run.href) text = `<a href="${esc(run.href)}" target="_blank" rel="noopener">${text}</a>`;
      return text;
    }).join('');
  }

  function blockHtml(block) {
    const text = rich(block.text || []);
    const children = (block.children || []).map(blockHtml).join('');
    switch (block.type) {
      case 'paragraph': return `<p>${text || '<br>'}</p>${children}`;
      case 'heading_1': return `<h1>${text}</h1>${children}`;
      case 'heading_2': return `<h2>${text}</h2>${children}`;
      case 'heading_3': return `<h3>${text}</h3>${children}`;
      case 'quote': return `<blockquote>${text}${children}</blockquote>`;
      case 'bulleted_list_item': return `<ul><li>${text}${children}</li></ul>`;
      case 'numbered_list_item': return `<ol><li>${text}${children}</li></ol>`;
      case 'divider': return '<hr>';
      case 'image': return block.url ? `<figure><img src="${esc(block.url)}" alt="${esc(block.caption || '小家里的图片')}" loading="lazy"></figure>${children}` : children;
      default: return text ? `<p>${text}</p>${children}` : children;
    }
  }

  function forceVisible() {
    const status = document.querySelector('#readerStatus');
    const error = document.querySelector('#readerError');
    const article = document.querySelector('#readerArticle');
    const content = document.querySelector('#notionContent');
    if (status) status.classList.add('is-hidden');
    if (error && !error.querySelector('#readerErrorText')?.textContent?.includes('门票')) error.classList.add('is-hidden');
    for (const node of [article, content]) {
      if (!node) continue;
      node.classList.remove('is-hidden');
      node.style.setProperty('display', node === article ? 'block' : 'block', 'important');
      node.style.setProperty('visibility', 'visible', 'important');
      node.style.setProperty('opacity', '1', 'important');
      node.style.setProperty('height', 'auto', 'important');
      node.style.setProperty('max-height', 'none', 'important');
    }
  }

  async function recoverBody() {
    const content = document.querySelector('#notionContent');
    const article = document.querySelector('#readerArticle');
    if (!content || !article) return;

    forceVisible();
    if (content.children.length || content.textContent.trim()) return;
    if (!pageId) return;

    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/page/${encodeURIComponent(pageId)}?kind=${encodeURIComponent(kind)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;

      const html = (data.blocks || []).map(blockHtml).join('');
      content.innerHTML = html || '<p>这一页目前只有标题，没有正文。</p>';
      forceVisible();
    } catch (error) {
      console.warn('Reader recovery skipped:', error);
    }
  }

  // iOS Safari can keep an older reader asset in cache after a Pages deploy.
  // This small independent recovery layer runs after all normal reader scripts.
  setTimeout(forceVisible, 60);
  setTimeout(recoverBody, 500);
  setTimeout(recoverBody, 1600);
})();
