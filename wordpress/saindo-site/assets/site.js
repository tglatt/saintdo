/* Menu mobile, lightbox des plans et vidéo de l'accueil — porté depuis les scripts Astro. */
(function () {
  var hamburger = document.getElementById('hamburger');
  var mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
      mobileMenu.setAttribute('aria-hidden', String(!open));
    });
    
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
      });
    });
  }

  var lightbox = document.getElementById('lightbox');
  if (lightbox) {
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    
    function openLightbox(img) {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.remove('hidden');
    }
    
    function closeLightbox() {
      lightbox.classList.add('hidden');
      lightboxImg.src = '';
    }
    
    document.querySelectorAll('.plan-image').forEach(img => {
      img.addEventListener('click', () => openLightbox(img));
    });
    
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  var facade = document.getElementById('video-facade');
  var wrapper = document.getElementById('video-wrapper');
  if (facade && wrapper) {
    
    facade.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = 'https://geo.dailymotion.com/player.html?video=xalatbu&autoplay=1&queue-enable=false&queue-autoplay-ui=false';
      iframe.allow = 'autoplay; fullscreen; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.setAttribute('frameborder', '0');
      // Élément créé dynamiquement : le CSS scopé d'Astro ne s'applique pas, on style en inline.
      iframe.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; border:0; display:block;';
      wrapper.replaceChildren(iframe);
    });
  }
})();
