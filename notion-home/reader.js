(() => {
  const API_BASE = 'https://keats-home-notion.k995680983-3fb.workers.dev';
  const SESSION_KEY = 'keatsHome.sessionToken';
  const qs = selector => document.querySelector(selector);

  const params = new URLSearchParams(location.search);
  const pageId = params.get('id') || '';
  const kind = params.get('kind') || 'diary';

  const labels = {
    diary: { icon: '✎', label: 'DIARY' },
    letters: { icon: '✉', label: 'LETTER' },
    memories: { icon: '✦', label: 'MEMORY' },
    timeline: { icon: '⌁', label: 'TIMELINE' },
    quotes: { icon: '❝', label: 'OUR WORDS' },
    songs: { icon: '♫', label: 'PLAYLIST NOTE' }
  };

  function esc(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    }).format(date);
  }

  function renderRich(runs = []) {
    return runs.map(run => {
      let content = esc(run.text || '').replace(/\n/g, '<br>');
      const a = run.annotations || {};
      if (a.code) content = `<code>${content}</code>`;
      if (a.bold) content = `<strong>${content}</strong>`;
      if (a.italic) content = `<em>${content}</em>`;
      if (a.strikethrough) content = `<s>${content}</s>`;
      if (a.underline) content = `<u>${content}</u>`;
      if (run.href) content = `<a href="${esc(run.href)}" target="_blank" rel="noopener">${content}</a>`;
      return content;
    }).join('');
  }

  function renderChildren(children = []) {
    return children.map(renderBlock).join('');
  }

  function renderBlock(block) {
    const text = renderRich(block.text || []);
    const children = renderChildren(block.children || []);

    switch (block.type) {
      case 'paragraph': return `<p>${text || '<br>'}</p>${children}`;
      case 'heading_1': return `<h1>${text}</h1>${children}`;
      case 'heading_2': return `<h2>${text}</h2>${children}`;
      case 'heading_3': return `<h3>${text}</h3>${children}`;
      case 'quote': return `<blockquote>${text}${children}</blockquote>`;
      case 'bulleted_list_item': return `<ul><li>${text}${children}</li></ul>`;
      case 'numbered_list_item': return `<ol><li>${text}${children}</li></ol>`;
      case 'to_do': return `<label class="notion-check"><input type="checkbox" disabled ${block.checked ? 'checked' : ''}><span>${text}${children}</span></label>`;
      case 'divider': return '<hr>';
      case 'code': return `<pre><code>${esc((block.text || []).map(run => run.text || '').join(''))}</code></pre>${children}`;
      case 'equation': return `<pre>${esc(block.expression || '')}</pre>`;
      case 'callout': return `<div class="notion-callout"><span>${esc(block.icon || '✦')}</span><div>${text}${children}</div></div>`;
      case 'toggle': return `<details class="notion-toggle"><summary>${text || '展开'}</summary>${children}</details>`;
      case 'image': return block.url
        ? `<figure><img src="${esc(block.url)}" alt="${esc(block.caption || '小家里的图片')}" loading="lazy">${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ''}</figure>${children}`
        : children;
      case 'bookmark':
      case 'embed':
      case 'link_preview': return block.url
        ? `<a class="notion-bookmark" href="${esc(block.url)}" target="_blank" rel="noopener">${esc(block.caption || block.url)} ↗</a>${children}`
        : children;
      case 'video': return block.url ? `<p><a href="${esc(block.url)}" target="_blank" rel="noopener">打开视频 ↗</a></p>${children}` : children;
      case 'file':
      case 'pdf':
      case 'audio': return block.url ? `<p><a href="${esc(block.url)}" target="_blank" rel="noopener">打开附件 ↗</a></p>${children}` : children;
      case 'child_page':
      case 'child_database': return `<p><strong>${esc(block.title || '')}</strong></p>${children}`;
      case 'table': return `<div class="notion-table-wrap"><table class="notion-table">${children}</table></div>`;
      case 'table_row': return `<tr>${(block.cells || []).map(cell => `<td>${renderRich(cell)}</td>`).join('')}</tr>`;
      default: return text ? `<p>${text}</p>${children}` : children;
    }
  }

  function summaryFor(item) {
    return item.summary || item.text || item.note || item.quote || item.reason || '';
  }

  function tagsFor(item) {
    if (kind === 'diary') return [...(item.types || []), ...(item.moods || [])];
    if (kind === 'letters') return [item.category, item.status].filter(Boolean);
    if (kind === 'memories') return [item.type, item.category, item.importance].filter(Boolean);
    if (kind === 'timeline') return [item.type, item.status].filter(Boolean);
    if (kind === 'quotes') return [...(item.feelings || []), item.source].filter(Boolean);
    if (kind === 'songs') return [...(item.moods || []), item.recommender].filter(Boolean);
    return [];
  }

  function metaFor(item) {
    const meta = [];
    if (item.date) meta.push(`<span><i></i>${esc(formatDate(item.date))}</span>`);
    if (item.author) meta.push(`<span>${esc(item.author)}</span>`);
    if (item.recipient) meta.push(`<span>写给 ${esc(item.recipient)}</span>`);
    if (item.artist) meta.push(`<span>${esc(item.artist)}</span>`);
    if (item.keatsState) meta.push(`<span>${esc(item.keatsState)}</span>`);
    return meta.join('');
  }

  function footerFor(item) {
    if (kind === 'diary' && item.author === 'Keats') return '🐾 豹豹写到这里，尾巴还压在纸角。';
    if (kind === 'diary') return '🐾 这一页被好好收起来了。';
    if (kind === 'letters') return '✉ 信纸折到这里。';
    if (kind === 'memories') return '✦ 以后再回来，它还会在这里。';
    if (kind === 'timeline') return '⌁ 这个节点先轻轻钉在时间里。';
    if (kind === 'quotes') return '❝ 这句话没有被当天带走。';
    if (kind === 'songs') return '♫ 这一首歌先放在小家里。';
    return '☾ 这一页翻到这里。';
  }

  function showError(message) {
    qs('#readerStatus').classList.add('is-hidden');
    qs('#readerArticle').classList.add('is-hidden');
    qs('#readerError').classList.remove('is-hidden');
    qs('#readerErrorText').textContent = message;
  }

  async function loadPage() {
    if (!pageId) {
      showError('网址里没有这一页的编号。');
      return;
    }
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      showError('这张浏览器门票不在了。回首页点一下 “Notion 已连接 / 开门”，再从小家里打开这一页。');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/page/${encodeURIComponent(pageId)}?kind=${encodeURIComponent(kind)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) sessionStorage.removeItem(SESSION_KEY);
        throw new Error(data.error || '这一页暂时拿不到。');
      }

      const item = data.item || {};
      const descriptor = labels[kind] || labels.diary;
      document.title = `${item.title || '这一页'} · Keats Home`;
      qs('#kindIcon').textContent = descriptor.icon;
      qs('#kindLabel').textContent = descriptor.label;
      qs('#pageTitle').textContent = item.title || '这一页';
      qs('#pageSummary').textContent = summaryFor(item);
      qs('#pageMeta').innerHTML = metaFor(item);
      qs('#pageTags').innerHTML = tagsFor(item).map(tag => `<span>${esc(tag)}</span>`).join('');
      qs('#notionContent').innerHTML = (data.blocks || []).map(renderBlock).join('') || '<p>这一页目前只有标题，没有正文。</p>';
      qs('#articleFooter').textContent = footerFor(item);

      if (item.notionUrl) {
        const notionLink = qs('#notionLink');
        notionLink.href = item.notionUrl;
        notionLink.classList.remove('is-hidden');
      }

      qs('#readerStatus').classList.add('is-hidden');
      qs('#readerArticle').classList.remove('is-hidden');
    } catch (error) {
      showError(error.message || '这一页暂时没翻开。');
    }
  }

  qs('#backButton').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.href = './';
  });

  const hour = new Date().getHours();
  document.body.classList.toggle('is-night', hour >= 19 || hour < 6);
  loadPage();
})();
