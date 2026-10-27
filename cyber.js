// Efecto de inclinación 3D en las tarjetas al mover el mouse
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  var MAX = 12; // grados máximos de inclinación
  var cards = document.querySelectorAll('.feat, .service-card, .resource-card, .enfoque-card, .dato, .review');

  cards.forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'rotateX(' + (-y * MAX) + 'deg) rotateY(' + (x * MAX) + 'deg) translateZ(10px)';
    });
    card.addEventListener('mouseleave', function () {
      card.style.transform = '';
    });
  });
})();

// Videos de YouTube: se carga el reproductor solo al hacer clic
(function () {
  document.querySelectorAll('.yt[data-id]').forEach(function (btn) {
    btn.style.backgroundImage = 'url(https://i.ytimg.com/vi/' + btn.dataset.id + '/hqdefault.jpg)';
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
    });
    btn.addEventListener('click', function () {
      if (btn.classList.contains('playing')) return;
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + btn.dataset.id + '?autoplay=1&rel=0';
      f.title = btn.getAttribute('aria-label') || 'Video';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      btn.appendChild(f);
      btn.classList.add('playing');
    });
  });
})();
