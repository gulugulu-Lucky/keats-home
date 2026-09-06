(() => {
  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => [...root.querySelectorAll(s)];

  const roomNotes = {
    diary: '和小猫一起的柔软日常 ♡',
    letters: '慢慢写，慢慢寄 ♡',
    pawprints: '豹豹来过这里 🐾',
    memories: '把重要的事收好 ♡',
    timeline: '日子一格一格长大',
    album: '想一直留着的画面',
    quotes: '有些话值得贴在墙上',
    songs: '让小家有一点声音',
    futuremail: '写给以后再打开',
    magazine: '把一个月装订起来'
  };

  function escapeText(value = '') {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }

  function cottageArt(note = 'Good days with Keats ♡', compact = false) {
    const safe = escapeText(note);
    return `
      <svg viewBox="0 0 460 280" role="img" aria-label="窗边睡猫、植物和小纸条组成的手绘小家">
        <rect class="sky" x="254" y="12" width="184" height="154" rx="4"/>
        <path d="M254 12v154M346 12v154M254 89h184M438 12v154" class="sketch"/>
        <path d="M260 127c26-18 47-12 67-30 18-16 35-10 58-21 17-8 31-6 51-8v98H254z" fill="#eef7fa"/>
        <circle cx="397" cy="48" r="19" fill="#fff8dc" opacity=".92"/>
        <path d="M388 43c8-7 18-8 28-3" class="soft-line"/>

        <path d="M242 166h204" class="sketch"/>
        <rect class="wood" x="235" y="166" width="211" height="15" rx="3"/>

        <g transform="translate(286 120)">
          <path class="cat" d="M12 39c2-22 19-34 45-34 31 0 55 16 61 39-6 22-30 31-62 31-31 0-48-13-44-36z"/>
          <path class="cat-dark" d="M57 13c14-11 36-7 45 7l9 18c-12-9-25-14-38-13-6-6-11-9-16-12z" opacity=".88"/>
          <path class="cat" d="M22 33c-2-17 8-29 23-29 17 0 28 12 27 30l-4 18-43-1z"/>
          <path class="sketch" d="M27 13l7-12 9 10m11 0L65 1l4 15M33 34c7 4 15 4 22 0M43 30h2"/>
          <path class="soft-line" d="M28 29l-15-3m15 9-16 2m47-8 15-3m-15 9 16 3"/>
          <path class="sketch" d="M111 45c17 4 23 14 17 21-8 8-25 4-34-5"/>
        </g>

        <g transform="translate(376 169)">
          <path class="mug" d="M0 0h42v43c0 8-6 14-14 14H14C6 57 0 51 0 43z"/>
          <path class="sketch" d="M42 12c20-2 21 27 2 29"/>
          <path class="soft-line" d="M13 17h17m-14 9h11"/>
        </g>

        <g transform="translate(18 34)">
          <path class="sketch" d="M0 74h170"/>
          <path class="wood" d="M3 74h167v10H3z"/>
          <rect class="paper-note" x="100" y="13" width="60" height="47" rx="2" transform="rotate(2 130 37)"/>
          <text x="111" y="31" font-size="10">Live a soft</text>
          <text x="116" y="44" font-size="10">little life ♡</text>
          <path class="sketch" d="M29 72c-3-26 2-45 14-60m-8 29C20 32 12 31 5 35m33-6c13-11 25-12 35-7m-38 33c-13-5-24-3-33 6"/>
          <g class="leaf"><ellipse cx="11" cy="35" rx="12" ry="7" transform="rotate(-28 11 35)"/><ellipse cx="66" cy="21" rx="13" ry="7" transform="rotate(18 66 21)"/><ellipse cx="9" cy="61" rx="12" ry="7" transform="rotate(18 9 61)"/><ellipse cx="53" cy="48" rx="12" ry="7" transform="rotate(-19 53 48)"/></g>
          <rect x="74" y="45" width="16" height="29" rx="2" fill="#e8c9b9" stroke="#80583d" stroke-width="1.4"/>
          <rect x="90" y="39" width="15" height="35" rx="2" fill="#d7dfca" stroke="#80583d" stroke-width="1.4"/>
        </g>

        <g transform="translate(36 165)">
          <rect class="paper-note" x="0" y="0" width="166" height="64" rx="4" transform="rotate(-2 83 32)"/>
          <path d="M71 -4h40v12H71z" fill="#ead1a8" opacity=".65" transform="rotate(1 91 2)"/>
          <text x="18" y="27" font-size="13">${safe}</text>
          <text x="18" y="45" font-size="10" opacity=".75">Keats Home</text>
        </g>

        ${compact ? '' : `
        <g transform="translate(191 194)">
          <path class="sketch" d="M0 30c16-10 34-9 52 1M15 31v32m23-32v32M6 63h42"/>
          <path class="leaf" d="M18 10c-12 2-18 10-17 19 9 4 18 1 24-8 0-5-2-8-7-11z"/>
          <path class="leaf" d="M34 7c11 1 18 8 19 17-8 5-17 3-24-5-1-5 1-9 5-12z"/>
        </g>`}
      </svg>`;
  }

  function redrawHome() {
    const scene = qs('#view-home .hero-scene');
    if (!scene) return;
    scene.className = 'hero-scene cottage-home-scene';
    scene.innerHTML = cottageArt('有猫，有你，就是家。', false);
  }

  function installPageArt() {
    qsa('.view:not(#view-home)').forEach(view => {
      const heading = qs('.page-heading', view);
      if (!heading) return;
      let art = qs('.cottage-page-art', heading);
      if (!art) {
        art = document.createElement('div');
        art.className = 'cottage-page-art';
        heading.appendChild(art);
      }
      const key = view.id.replace('view-', '');
      art.innerHTML = cottageArt(roomNotes[key] || 'Keats Home ♡', true);
    });
  }

  function install() {
    document.body.classList.add('cottage-house-v1');
    redrawHome();
    installPageArt();
  }

  install();
  requestAnimationFrame(install);
  setTimeout(install, 120);
  setTimeout(install, 800);
  window.addEventListener('pageshow', install);
  window.addEventListener('hashchange', () => setTimeout(install, 40));
})();
