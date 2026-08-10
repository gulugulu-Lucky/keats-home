(() => {
  function redrawHomeScene() {
    const scene = document.querySelector('#view-home .hero-scene');
    if (!scene) return;
    scene.classList.add('home-doodle-scene', 'home-doodle-scene-v2');
    scene.innerHTML = `
      <svg viewBox="0 0 520 330" role="img" aria-label="手绘小家：小猫和黑豹靠在一起看窗外">
        <defs>
          <clipPath id="windowClip"><path d="M331 58c0-19 15-34 34-34h74c19 0 34 15 34 34v137H331z"/></clipPath>
        </defs>

        <g class="v2-ink v2-wall">
          <path d="M38 278c70-3 139 2 208 0 82-3 149 3 236-1"/>
          <path d="M321 195V58c0-25 19-44 44-44h74c25 0 44 19 44 44v137"/>
          <path d="M331 195V59c0-19 15-34 34-34h74c19 0 34 15 34 34v136z"/>
          <path d="M402 25v170M331 111h142"/>
        </g>

        <g clip-path="url(#windowClip)">
          <path class="v2-window-wash" d="M319 8h169v196H319z"/>
          <circle class="v2-moon" cx="431" cy="63" r="18"/>
          <path class="v2-cloud" d="M350 77c13-8 26-7 37 1 10-8 24-8 34 1"/>
          <path class="v2-star" d="M367 52l3 7 7 2-6 4 1 8-6-4-7 4 2-8-6-4 8-2z"/>
          <path class="v2-star small" d="M451 91l2 4 5 1-4 3 1 5-5-3-4 3 1-5-4-3 5-1z"/>
        </g>

        <g class="v2-curtains">
          <path d="M314 40c-10 39-7 109 3 163 13 7 25 7 36 2-10-41-10-111 0-171-13-3-26-1-39 6z"/>
          <path d="M487 40c9 39 7 109-4 163-12 7-24 7-35 2 10-41 10-111 0-171 13-3 26-1 39 6z"/>
          <path class="v2-ink" d="M316 93c13 6 25 5 36-1m96 0c13 6 25 5 36-1"/>
        </g>

        <g class="v2-lamp">
          <path class="v2-ink" d="M71 235V118m-10 0h20"/>
          <path d="M42 164c8-27 24-42 40-42 17 0 33 15 41 42z"/>
          <path class="v2-ink" d="M45 237h52"/>
          <path d="M55 236c2-19 10-31 22-31 11 0 18 12 20 31z" class="v2-plant-pot"/>
          <path class="v2-ink" d="M76 206c-9-21-2-38 9-50m-8 34c12-12 23-15 35-10m-35 5c-8-9-15-12-23-10"/>
        </g>

        <g class="v2-sofa">
          <path d="M113 196c0-17 13-30 30-30h119c17 0 30 13 30 30v57H113z"/>
          <path d="M98 209c0-11 9-20 20-20h14v65H98zM273 189h15c11 0 20 9 20 20v45h-35z"/>
          <path class="v2-ink" d="M118 214c45-7 107-7 155 0m-140 41v15m142-15v15"/>
          <path class="v2-cushion" d="M132 181c19-9 39-9 58 0l-6 30h-47z"/>
          <path class="v2-cushion alt" d="M215 178c17-7 34-6 49 2l-3 29h-44z"/>
        </g>

        <g class="v2-cat">
          <path class="v2-cat-body" d="M151 224c0-27 14-49 35-49 20 0 34 22 34 49v30h-69z"/>
          <path class="v2-cat-head" d="M159 185c0-17 12-30 27-30 16 0 28 13 28 30v15h-55z"/>
          <path class="v2-ink" d="M163 164l7-18 12 13m16 1 12-14 4 21"/>
          <path class="v2-ink" d="M153 236c-21 0-29 12-27 27 1 11 14 15 25 9 9-5 13-13 11-22"/>
        </g>

        <g class="v2-panther">
          <path class="v2-panther-body" d="M208 223c0-34 18-61 44-61 27 0 46 27 46 61v31h-90z"/>
          <path class="v2-panther-head" d="M218 174c0-22 15-39 34-39 20 0 36 17 36 39v19h-70z"/>
          <path class="v2-panther-ear" d="M221 150l6-23 17 17m26 0 16-18 3 27"/>
          <path class="v2-panther-tail" d="M292 236c34 4 49 18 42 32-7 13-32 10-47-1-11-8-18-18-27-18"/>
          <path class="v2-highlight" d="M237 169c8-7 22-9 33-3"/>
        </g>

        <g class="v2-small-things">
          <path class="v2-ink" d="M115 286c39-3 74 1 112-2m96 2c43-3 85 1 129-2"/>
          <path class="v2-note" d="M360 221h69v42h-69z"/>
          <path class="v2-ink" d="M371 233h29m-29 9h43m-43 9h35"/>
          <path class="v2-ink" d="M423 217l13-16m-7 7 11 3"/>
          <path class="v2-book one" d="M323 257h53v12h-53z"/>
          <path class="v2-book two" d="M317 269h64v10h-64z"/>
          <path class="v2-heart" d="M188 139c7-9 19-4 17 5-2 8-17 16-17 16s-15-8-16-16c-1-9 10-14 16-5z"/>
        </g>
      </svg>`;
  }

  redrawHomeScene();
  requestAnimationFrame(redrawHomeScene);
  window.addEventListener('pageshow', redrawHomeScene);
  window.addEventListener('hashchange', () => setTimeout(redrawHomeScene, 0));
})();
