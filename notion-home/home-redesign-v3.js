(() => {
  function applyHomeV3() {
    const hero = document.querySelector('#view-home .hero-card');
    const title = hero?.querySelector('.hero-copy h1');
    if (title && !title.dataset.v3) {
      title.dataset.v3 = 'true';
      title.innerHTML = '<span class="hero-welcome">欢迎回家</span><em class="hero-kitten">小猫。</em>';
    }

    const copy = hero?.querySelector('.hero-copy > p');
    if (copy) copy.textContent = '外面很吵也没关系。回家以后，慢一点。';

    const diary = hero?.querySelector('.primary-button[data-view="diary"]');
    if (diary) diary.innerHTML = '翻开今天 <span>→</span>';

    const paw = hero?.querySelector('.text-button[data-view="pawprints"]');
    if (paw) paw.textContent = '看看豹豹留下了什么';
  }

  applyHomeV3();
  requestAnimationFrame(applyHomeV3);
  window.addEventListener('pageshow', applyHomeV3);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyHomeV3();
  });
})();
