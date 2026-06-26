(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('sede-button');
    var dropdown = document.getElementById('sede-dropdown');
    if (!button || !dropdown) return;

    maliWidgetFetch('/educacion/config')
      .then(function (config) {
        var sedes = config.sedes
          .filter(function (s) {
            return s.showOnSelector;
          })
          .sort(function (a, b) {
            return a.sortOrder - b.sortOrder;
          });

        sedes.forEach(function (sede) {
          var item = document.createElement('div');
          item.className = 'sede-item';
          item.textContent = sede.nombre;
          item.onclick = function () {
            window.open(sede.brochureUrl, '_blank', 'noopener,noreferrer');
            dropdown.style.display = 'none';
          };
          dropdown.appendChild(item);
        });

        button.onclick = function (e) {
          e.stopPropagation();
          dropdown.style.display =
            dropdown.style.display === 'block' ? 'none' : 'block';
        };

        document.addEventListener('click', function () {
          dropdown.style.display = 'none';
        });
      })
      .catch(function (err) {
        console.error('Error cargando selector de sedes', err);
      });
  });
})();
