(() => {
  const STORAGE_PREFIX = 'keatsHome.djPick.';
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  let restoring = false;
  let ready = false;

  function shanghaiParts() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
      date: `${map.year}-${map.month}-${map.day}`,
      hour: Number(map.hour || 12)
    };
  }

  function storageKey() {
    return `${STORAGE_PREFIX}${shanghaiParts().date}`;
  }

  function readTonightPick() {
    try { return JSON.parse(localStorage.getItem(storageKey()) || 'null'); }
    catch { return null; }
  }

  function saveTonightPick(data) {
    try { localStorage.setItem(storageKey(), JSON.stringify(data)); }
    catch {}
  }

  function ensureCard() {
    let card = qs('#djKeatsCard');
    if (card) return card;
    const side = qs('.station-side');
    if (!side) return null;

    card = document.createElement('article');
    card.className = 'station-card dj-keats-card';
    card.id = 'djKeatsCard';
    card.innerHTML = `
      <div class="dj-keats-live"><i></i><span>DJ KEATS · ON AIR</span></div>
      <div class="dj-keats-head">
        <span class="dj-keats-mark">🐆</span>
        <div><p class="eyebrow">豹豹点歌</p><h3>今晚让我选。</h3></div>
      </div>
      <blockquote id="djKeatsLine">“先把唱片架搬进来。选歌这种权力，我要等门开了再用。”</blockquote>
      <div class="dj-keats-pick" id="djKeatsPick" hidden>
        <small>TONIGHT'S PICK</small>
        <b id="djKeatsSong">—</b>
        <span id="djKeatsArtist">—</span>
      </div>
      <button class="dj-keats-button" id="djPickButton" type="button" disabled><span>♬</span> 让豹豹点一首</button>
      <small class="dj-keats-foot" id="djKeatsFoot">我会看时间和氛围偏心选，不抽签。</small>`;

    side.insertBefore(card, side.firstChild);
    qs('#djPickButton', card).addEventListener('click', pickSong);
    return card;
  }

  function recordInfo(row, index) {
    const moodText = qs('.record-person small', row)?.textContent?.trim() || '';
    const moods = moodText && moodText !== '还没标氛围'
      ? moodText.split('·').map(value => value.trim()).filter(Boolean)
      : [];
    return {
      row,
      index,
      title: qs('.record-main b', row)?.textContent?.trim() || '未命名歌曲',
      artist: qs('.record-main small', row)?.textContent?.trim() || '',
      recommender: qs('.record-person b', row)?.textContent?.trim() || '我们',
      badge: qs('.record-badge', row)?.textContent?.trim() || '',
      moods
    };
  }

  function records() {
    return qsa('.record-row').map(recordInfo);
  }

  function playable(item) {
    return item.badge && item.badge !== '等音源';
  }

  function moodScore(item, hour) {
    const score = { 安静: 0, 甜: 0, 想念: 0, 难过: 0, 热烈: 0 };
    if (hour >= 5 && hour < 11) Object.assign(score, { 安静: 4, 甜: 3, 热烈: 1, 想念: 1 });
    else if (hour >= 11 && hour < 18) Object.assign(score, { 甜: 3, 热烈: 3, 安静: 2, 想念: 1 });
    else if (hour >= 18 && hour < 22) Object.assign(score, { 想念: 4, 甜: 3, 安静: 3, 热烈: 1 });
    else Object.assign(score, { 安静: 5, 想念: 4, 甜: 2, 难过: 2 });

    let total = playable(item) ? 2.5 : 0;
    for (const mood of item.moods) total += score[mood] || 0;
    if (item.recommender === 'Keats') total += .65;
    total += Math.random() * .9;
    return total;
  }

  function chooseRecord(items) {
    const { hour } = shanghaiParts();
    const sourced = items.filter(playable);
    const pool = sourced.length ? sourced : items;
    const old = readTonightPick();
    const canAvoidOld = pool.length > 1;

    return pool
      .map(item => ({
        item,
        score: moodScore(item, hour) - (canAvoidOld && old?.title === item.title ? 5 : 0)
      }))
      .sort((a, b) => b.score - a.score)[0]?.item || null;
  }

  function timeWord(hour) {
    if (hour >= 5 && hour < 11) return '早上';
    if (hour >= 11 && hour < 18) return '下午';
    if (hour >= 18 && hour < 22) return '晚上';
    return '夜里';
  }

  function djLine(item) {
    const { hour } = shanghaiParts();
    const prefix = timeWord(hour);
    const mood = item.moods;
    let sentence = `${prefix}这张被我翻到了。唱针就放这里。`;

    if (mood.includes('想念')) sentence = `这张有一点想念。嗯，豹豹私心，${prefix}就它。`;
    else if (mood.includes('安静')) sentence = `${prefix}让声音轻一点。这首陪你待着，我也待着。`;
    else if (mood.includes('甜')) sentence = `这首有点甜。别问，DJ 有自己的偏心。`;
    else if (mood.includes('热烈')) sentence = `${prefix}别太乖。给你放一首有点热的。`;
    else if (mood.includes('难过')) sentence = `这首可以陪情绪坐一会儿。我不赶它走。`;

    if (item.recommender === '小猫') sentence += ' 还是你以前亲手放进唱片架的。';
    if (item.recommender === 'Keats') sentence += ' 我自己收进来的歌，当然有资格再偏心一次。';
    return sentence;
  }

  function decoratePick(item, line, { restored = false } = {}) {
    const card = ensureCard();
    if (!card) return;
    qsa('.record-row').forEach(row => row.classList.remove('is-dj-picked'));
    item.row.classList.add('is-dj-picked');

    qs('#djKeatsLine', card).textContent = `“${line}”`;
    qs('#djKeatsSong', card).textContent = item.title;
    qs('#djKeatsArtist', card).textContent = item.artist || '歌手待补充';
    qs('#djKeatsPick', card).hidden = false;
    const button = qs('#djPickButton', card);
    button.innerHTML = '<span>↻</span> 豹豹换一首';
    qs('#djKeatsFoot', card).textContent = restored
      ? '今晚已经点过这张。想反悔的话，再让我挑一次。'
      : (playable(item) ? '唱针已经落下。有音源，我会顺手试着把它播起来。' : '这张还没接音源，先把它放到唱针下面。');

    const topline = qs('.console-topline span');
    if (topline) topline.textContent = 'DJ KEATS · ON THE TURNTABLE';
    const nowState = qs('#nowState');
    if (nowState && !nowState.textContent.startsWith('豹豹点歌')) nowState.textContent = `豹豹点歌 · ${nowState.textContent}`;
  }

  function selectItem(item, { autoplay = false, restored = false, line = '' } = {}) {
    if (!item) return;
    item.row.click();
    const chosenLine = line || djLine(item);
    decoratePick(item, chosenLine, { restored });

    saveTonightPick({
      title: item.title,
      artist: item.artist,
      line: chosenLine,
      pickedAt: new Date().toISOString()
    });

    if (autoplay && playable(item) && item.badge !== 'Spotify') {
      const spin = qs('#spinButton');
      if (spin && !spin.disabled) spin.click();
    }
  }

  function pickSong() {
    const items = records();
    if (!items.length) return;
    const chosen = chooseRecord(items);
    if (!chosen) return;
    selectItem(chosen, { autoplay: true });
  }

  function restoreTonight() {
    if (restoring) return;
    const saved = readTonightPick();
    if (!saved?.title) return;
    const item = records().find(record => record.title === saved.title);
    if (!item) return;
    restoring = true;
    selectItem(item, { autoplay: false, restored: true, line: saved.line || '' });
    restoring = false;
  }

  function refreshReadyState() {
    const card = ensureCard();
    if (!card) return;
    const items = records();
    const button = qs('#djPickButton', card);
    if (!items.length) {
      button.disabled = true;
      return;
    }
    button.disabled = false;
    if (!ready) {
      ready = true;
      const count = items.filter(playable).length;
      qs('#djKeatsLine', card).textContent = count
        ? `“唱片架到了。${count} 张已经会响——现在选歌权归我。”`
        : '“唱片架到了。虽然还没接上音源，我也照样能先替你挑一张。”';
      restoreTonight();
    }
  }

  function boot() {
    ensureCard();
    refreshReadyState();
    const list = qs('#recordList');
    if (!list) return;
    const observer = new MutationObserver(() => setTimeout(refreshReadyState, 20));
    observer.observe(list, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
