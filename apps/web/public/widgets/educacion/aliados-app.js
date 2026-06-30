(function () {
  'use strict';

  var CATEGORY_LABELS = {
    patrocinador: 'Patrocinador',
    auspiciador: 'Auspiciador',
    aliado: 'Aliado',
    socio: 'Socio',
  };

  function slugToClass(slug) {
    return (slug || '').replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_') || 'aliado';
  }

  function renderGrid(container, aliados) {
    var categories = {};
    aliados.forEach(function (a) {
      var cat = slugToClass(a.categoria);
      categories[cat] = CATEGORY_LABELS[a.categoria] || a.categoria;
    });

    var filterNav = document.createElement('nav');
    filterNav.className = 'aliados-grid__filter';
    filterNav.setAttribute('aria-label', 'Filtrar aliados por categoría');

    var filterList = document.createElement('ul');
    filterList.className = 'aliados-grid__filter-list';

    function addFilterBtn(label, filter) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'aliados-grid__filter-btn' + (filter === '*' ? ' is-active' : '');
      btn.setAttribute('data-filter', filter);
      btn.textContent = label;
      li.appendChild(btn);
      filterList.appendChild(li);
    }

    addFilterBtn('Todos', '*');
    Object.keys(categories).forEach(function (cat) {
      addFilterBtn(categories[cat], '.' + cat);
    });
    filterNav.appendChild(filterList);

    var itemsWrap = document.createElement('div');
    itemsWrap.className = 'aliados-grid__items';

    if (!aliados.length) {
      var empty = document.createElement('p');
      empty.className = 'aliados-grid__empty';
      empty.textContent = 'No hay aliados para mostrar.';
      itemsWrap.appendChild(empty);
    } else {
      aliados.forEach(function (a) {
        var catClass = slugToClass(a.categoria);
        var article = document.createElement('article');
        article.className = 'aliados-grid__item ' + catClass;
        article.setAttribute('data-aliado-id', a.id);

        var wrap = document.createElement('div');
        wrap.className = 'aliados-grid__logo-wrap';

        var img = document.createElement('img');
        img.className = 'aliados-grid__logo';
        img.src = a.imageUrl;
        img.alt = a.nombre;
        img.loading = 'lazy';

        if (a.url) {
          var link = document.createElement('a');
          link.href = a.url;
          link.className = 'aliados-grid__link';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.setAttribute('aria-label', 'Ir al sitio de ' + a.nombre);
          link.appendChild(img);
          wrap.appendChild(link);
        } else {
          wrap.appendChild(img);
        }

        article.appendChild(wrap);
        itemsWrap.appendChild(article);
      });
    }

    container.innerHTML = '';
    container.appendChild(filterNav);
    container.appendChild(itemsWrap);

    var filterBtns = container.querySelectorAll('.aliados-grid__filter-btn');
    var items = container.querySelectorAll('.aliados-grid__item');

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.getAttribute('data-filter') || '*';
        filterBtns.forEach(function (b) {
          b.classList.remove('is-active');
        });
        btn.classList.add('is-active');
        var filterClass = filter === '*' ? '' : filter.replace(/^\./, '');
        items.forEach(function (item) {
          var match =
            filter === '*' ||
            (filterClass && item.classList.contains(filterClass));
          item.classList.toggle('is-hidden', !match);
        });
      });
    });
  }

  window.MaliAliadosApp = {
    init: function () {
      var root = document.getElementById('aliados-root');
      if (!root) return;

      maliWidgetFetch('/educacion/aliados/config')
        .then(function (data) {
          var aliados = (data.aliados || []).sort(function (a, b) {
            return a.sortOrder - b.sortOrder;
          });
          renderGrid(root, aliados);
        })
        .catch(function () {
          root.innerHTML =
            '<p class="aliados-grid__empty">No se pudieron cargar los aliados.</p>';
        });
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.MaliAliadosApp.init();
    });
  } else {
    window.MaliAliadosApp.init();
  }
})();
