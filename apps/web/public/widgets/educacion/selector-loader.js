(function () {
  'use strict';

  function scriptOrigin() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      if (src.indexOf('selector-loader.js') !== -1) {
        return src.replace(/\/widgets\/educacion\/selector-loader\.js.*$/, '');
      }
    }
    return '';
  }

  function widgetApiBase() {
    return scriptOrigin() + '/api/widgets';
  }

  function loadStylesheet(href, marker) {
    if (document.querySelector('link[data-mali-css="' + marker + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-mali-css', marker);
    document.head.appendChild(link);
  }

  function loadMaterialIcons() {
    if (document.querySelector('link[data-mali-material-icons]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    link.setAttribute('data-mali-material-icons', '1');
    document.head.appendChild(link);
  }

  function sedeIcon(sede) {
    return sede.icon && String(sede.icon).trim();
  }

  function buildShell() {
    if (document.getElementById('mali-sede-selector')) return null;

    var container = document.createElement('div');
    container.className = 'mali-sede-container';
    container.innerHTML =
      '<div class="mali-sede-wrapper">' +
      '<button type="button" class="mali-btn mali-btn-circle" id="mali-sede-selector" aria-expanded="false" aria-haspopup="true" aria-label="Ver cursos y horarios">' +
      '<span class="mali-btn-text">Ver cursos y horarios</span>' +
      '<i class="material-icons">place</i>' +
      '<div class="mali-dropdown" role="menu"><ul id="mali-sedes-list"></ul></div>' +
      '</button>' +
      '<div id="mali-sede-tooltip" class="mali-tooltip-sede" role="tooltip">Ver cursos y horarios</div>' +
      '</div>';

    document.body.appendChild(container);
    return container;
  }

  function initSelector(sedes) {
    var origin = scriptOrigin();
    loadMaterialIcons();
    loadStylesheet(origin + '/widgets/educacion/benton-sans.css', 'benton-sans');
    loadStylesheet(origin + '/widgets/educacion/selector-loader.css', 'selector');
    buildShell();

    var btn = document.getElementById('mali-sede-selector');
    var list = document.getElementById('mali-sedes-list');
    var tooltip = document.getElementById('mali-sede-tooltip');
    if (!btn || !list) return;

    var btnText = btn.querySelector('.mali-btn-text');

    sedes.sort(function (a, b) {
      return a.sortOrder - b.sortOrder;
    });

    sedes.forEach(function (sede) {
      var li = document.createElement('li');
      var link = document.createElement('a');
      link.href = '#';
      link.setAttribute('role', 'menuitem');
      link.setAttribute('data-sede', sede.slug);

      var icon = document.createElement('i');
      icon.className = 'material-icons mali-sede-icon';
      icon.textContent = sedeIcon(sede) || '';

      link.appendChild(icon);
      link.appendChild(document.createTextNode(sede.nombre));
      li.appendChild(link);
      list.appendChild(li);

      link.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        list.querySelectorAll('li').forEach(function (item) {
          item.classList.remove('mali-active');
        });
        li.classList.add('mali-active');
        if (btnText) btnText.textContent = sede.nombre;
        btn.classList.remove('mali-active');
        btn.setAttribute('aria-expanded', 'false');
        if (tooltip) tooltip.classList.remove('mali-hidden');
        if (sede.brochureUrl) {
          window.open(sede.brochureUrl, '_blank', 'noopener,noreferrer');
        }
      });
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var isActive = btn.classList.toggle('mali-active');
      btn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      if (tooltip) {
        if (isActive) tooltip.classList.add('mali-hidden');
        else tooltip.classList.remove('mali-hidden');
      }
    });

    btn.addEventListener(
      'touchstart',
      function (e) {
        e.stopPropagation();
      },
      { passive: true },
    );

    function closeDropdown() {
      btn.classList.remove('mali-active');
      btn.setAttribute('aria-expanded', 'false');
      if (tooltip) tooltip.classList.remove('mali-hidden');
    }

    document.addEventListener('click', function (e) {
      if (!btn.contains(e.target)) {
        if (btn.classList.contains('mali-active')) closeDropdown();
        else if (tooltip) tooltip.classList.remove('mali-hidden');
      }
    });

    document.addEventListener(
      'touchstart',
      function (e) {
        if (!btn.contains(e.target)) {
          if (btn.classList.contains('mali-active')) closeDropdown();
          else if (tooltip) tooltip.classList.remove('mali-hidden');
        }
      },
      { passive: true },
    );

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.classList.contains('mali-active')) {
        closeDropdown();
        btn.focus();
      }
    });
  }

  fetch(widgetApiBase() + '/educacion/selector/config')
    .then(function (res) {
      if (!res.ok) throw new Error('selector config');
      return res.json();
    })
    .then(function (data) {
      var sedes = data.sedes || [];
      if (!sedes.length) return;
      initSelector(sedes);
    })
    .catch(function () { /* selector no disponible */ });
})();
