(function () {
  'use strict';

  var POPUP_ID = 'mali-popup-main';

  function scriptOrigin() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      if (src.indexOf('popup-loader.js') !== -1) {
        return src.replace(/\/widgets\/educacion\/popup-loader\.js.*$/, '');
      }
    }
    return '';
  }

  function widgetApiBase() {
    var origin = scriptOrigin();
    return (origin || '') + '/api/widgets';
  }

  function loadStylesheet(href, marker) {
    if (document.querySelector('link[data-mali-css="' + marker + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-mali-css', marker);
    document.head.appendChild(link);
  }

  function buildPopupHtml() {
    if (document.getElementById(POPUP_ID)) return;

    var root = document.createElement('div');
    root.className = 'mali-popup';
    root.id = POPUP_ID;
    root.setAttribute('aria-hidden', 'true');
    root.style.display = 'none';
    root.innerHTML =
      '<div class="mali-popup__backdrop" data-mali-popup-close></div>' +
      '<div class="mali-popup__dialog" role="dialog" aria-modal="true">' +
      '<button class="mali-popup__close" type="button" aria-label="Cerrar" data-mali-popup-close>×</button>' +
      '<div class="mali-popup__content">' +
      '<div class="mali-popup-img-wrap">' +
      '<a href="#" id="mali-popup-img-link" target="_blank" rel="noopener noreferrer">' +
      '<img id="mali-popup-img" src="" alt="">' +
      '</a></div>' +
      '<div class="mali-popup-btn-external">' +
      '<a href="#" id="mali-popup-btn" class="mali-popup-btn" target="_blank" rel="noopener noreferrer">Ver más</a>' +
      '</div></div></div>';

    document.body.appendChild(root);
  }

  var MaliPopup = {
    config: null,
    lastFocusEl: null,

    init: function (config) {
      this.config = config;
      if (!config || !config.imagenUrl || !config.botonUrl) return;

      var origin = scriptOrigin();
      loadStylesheet(origin + '/widgets/educacion/benton-sans.css', 'benton-sans');
      loadStylesheet(origin + '/widgets/educacion/popup.css', 'popup');
      buildPopupHtml();
      this.injectContent();
      this.bindEvents();

      if (this.shouldShow()) {
        var delay = parseInt(config.delayMs, 10) || 800;
        var self = this;
        setTimeout(function () {
          self.open();
        }, delay);
      }
    },

    injectContent: function () {
      var cfg = this.config;
      var img = document.getElementById('mali-popup-img');
      var imgLink = document.getElementById('mali-popup-img-link');
      var btn = document.getElementById('mali-popup-btn');

      if (img) {
        img.src = cfg.imagenUrl;
        img.alt = cfg.titulo || 'Popup MALI';
      }
      if (imgLink && cfg.imagenLinkUrl) {
        imgLink.href = cfg.imagenLinkUrl;
        imgLink.target = cfg.imagenTarget || '_blank';
      } else if (imgLink) {
        imgLink.removeAttribute('href');
      }
      if (btn) {
        btn.textContent = cfg.botonTexto || 'Ver más';
        btn.href = cfg.botonUrl;
        btn.target = cfg.botonTarget || '_blank';
      }
    },

    bindEvents: function () {
      var self = this;
      document.addEventListener('click', function (e) {
        var target = e.target;
        if (target && target.closest && target.closest('[data-mali-popup-close]')) {
          e.preventDefault();
          self.close();
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') self.close();
      });
    },

    shouldShow: function () {
      if (!this.config.showOnce) return true;
      try {
        return localStorage.getItem('mali_popup_visto_' + location.hostname) !== '1';
      } catch (err) {
        return true;
      }
    },

    markSeen: function () {
      if (!this.config.showOnce) return;
      try {
        localStorage.setItem('mali_popup_visto_' + location.hostname, '1');
      } catch (err) { /* ignore */ }
    },

    open: function () {
      var popup = document.getElementById(POPUP_ID);
      if (!popup || popup.classList.contains('is-open')) return;
      this.lastFocusEl = document.activeElement;
      popup.classList.remove('is-closing');
      popup.setAttribute('aria-hidden', 'false');
      popup.style.display = 'flex';
      document.body.classList.add('mali-popup-open');
      var self = this;
      setTimeout(function () {
        popup.classList.add('is-open');
        var dialog = popup.querySelector('.mali-popup__dialog');
        if (dialog) dialog.focus();
      }, 10);
      this.markSeen();
    },

    close: function () {
      var popup = document.getElementById(POPUP_ID);
      if (!popup || !popup.classList.contains('is-open')) return;
      var speed = parseInt(this.config.animationSpeedMs, 10) || 300;
      popup.classList.add('is-closing');
      document.body.classList.remove('mali-popup-open');
      var self = this;
      setTimeout(function () {
        popup.classList.remove('is-open', 'is-closing');
        popup.setAttribute('aria-hidden', 'true');
        popup.style.display = 'none';
        if (self.lastFocusEl && self.lastFocusEl.focus) self.lastFocusEl.focus();
        self.lastFocusEl = null;
      }, speed);
    },
  };

  fetch(widgetApiBase() + '/educacion/popup/config')
    .then(function (res) {
      if (!res.ok) throw new Error('popup config');
      return res.json();
    })
    .then(function (config) {
      if (!config.activo) return;
      MaliPopup.init(config);
      window.MaliPopup = MaliPopup;
    })
    .catch(function () {
      /* popup desactivado o API no disponible */
    });
})();
