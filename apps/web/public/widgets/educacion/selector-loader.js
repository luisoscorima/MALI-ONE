(function () {
  'use strict';

  var INIT_FLAG = '__maliSelectorInit';

  function debugEnabled() {
    try {
      return (
        window.MALI_ONE_DEBUG === true ||
        window.localStorage.getItem('mali_one_debug') === '1' ||
        /[?&]mali_debug=1/.test(window.location.search)
      );
    } catch (err) {
      return false;
    }
  }

  function warn() {
    if (!debugEnabled()) return;
    console.warn.apply(console, ['[MALI ONE selector]'].concat([].slice.call(arguments)));
  }

  function resolveOrigin() {
    var embed = window.MALI_ONE_EMBED;
    if (embed && embed.baseUrl) {
      return String(embed.baseUrl).replace(/\/$/, '');
    }
    if (window.MALI_ONE_URL) {
      return String(window.MALI_ONE_URL).replace(/\/$/, '');
    }
    return scriptOrigin();
  }

  function embeddedConfig() {
    var embed = window.MALI_ONE_EMBED;
    if (!embed || !embed.selectorConfig) return null;
    return embed.selectorConfig;
  }

  function scriptOrigin() {
    var current = document.currentScript;
    if (current) {
      var fromCurrent = originFromScriptSrc(current.src || '');
      if (fromCurrent) return fromCurrent;
      var dataOrigin = current.getAttribute('data-mali-one-url');
      if (dataOrigin) return String(dataOrigin).replace(/\/$/, '');
    }

    if (window.MALI_ONE_URL) {
      return String(window.MALI_ONE_URL).replace(/\/$/, '');
    }

    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var fromScript = originFromScriptSrc(scripts[i].src || '');
      if (fromScript) return fromScript;
    }

    return '';
  }

  function originFromScriptSrc(src) {
    if (!src || src.indexOf('selector-loader.js') === -1) return '';
    return src.replace(/\/widgets\/educacion\/selector-loader\.js.*$/, '');
  }

  function widgetApiBase() {
    return scriptOrigin() + '/api/widgets';
  }

  function onReady(fn) {
    if (document.body) {
      fn();
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
      return;
    }
    fn();
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
    if (document.getElementById('mali-sede-selector')) return false;

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
    return true;
  }

  function initSelector(sedes) {
    if (window[INIT_FLAG]) return;
    window[INIT_FLAG] = true;

    var origin = resolveOrigin();
    if (!origin) {
      warn('No se detectó MALI_ONE_URL. Revisa MALI_ONE_URL en wp-config.php y el plugin mali-one-embed.');
      return;
    }

    loadMaterialIcons();
    loadStylesheet(origin + '/widgets/educacion/benton-sans.css', 'benton-sans');
    loadStylesheet(origin + '/widgets/educacion/selector-loader.css', 'selector');

    onReady(function () {
      buildShell();

      var btn = document.getElementById('mali-sede-selector');
      var list = document.getElementById('mali-sedes-list');
      var tooltip = document.getElementById('mali-sede-tooltip');
      if (!btn || !list) {
        warn('No se pudo montar el botón flotante (#mali-sede-selector).');
        return;
      }

      var btnText = btn.querySelector('.mali-btn-text');

      list.innerHTML = '';

      sedes.sort(function (a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });

      sedes.forEach(function (sede) {
        var li = document.createElement('li');
        var link = document.createElement('a');
        link.href = '#';
        link.setAttribute('role', 'menuitem');
        link.setAttribute('data-sede', sede.slug);

        var icon = document.createElement('i');
        icon.className = 'material-icons mali-sede-icon';
        icon.textContent = sedeIcon(sede) || 'location_on';

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
    });
  }

  function fetchConfig() {
    var origin = resolveOrigin();
    if (!origin) {
      return Promise.reject(new Error('Origen MALI ONE no detectado'));
    }

    return fetch(origin + '/api/widgets/educacion/selector/config', {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    }).then(function (res) {
      if (!res.ok) throw new Error('selector/config HTTP ' + res.status);
      return res.json();
    });
  }

  function bootstrap() {
    var embedded = embeddedConfig();
    if (embedded && embedded.sedes && embedded.sedes.length) {
      initSelector(embedded.sedes);
      return;
    }

    fetchConfig()
      .then(function (data) {
        var sedes = data.sedes || [];
        if (!sedes.length) {
          warn('La API respondió sin sedes activas.');
          return;
        }
        initSelector(sedes);
      })
      .catch(function (err) {
        warn(
          'No se pudo cargar el selector. Comprueba MALI_ONE_URL en wp-config.php o usa ?mali_debug=1.',
          err,
        );
      });
  }

  bootstrap();
})();
