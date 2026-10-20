// Efecto de inclinación 3D en las tarjetas al mover el mouse
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  var MAX = 12; // grados máximos de inclinación
  var cards = document.querySelectorAll('.feat, .service-card, .resource-card, .enfoque-card, .dato');

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
