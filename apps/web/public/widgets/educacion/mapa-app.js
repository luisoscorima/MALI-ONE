(function () {
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function applyContacts(settings) {
    document.querySelectorAll('[data-contact]').forEach(function (el) {
      var key = el.getAttribute('data-contact');
      if (key === 'whatsapp') el.textContent = settings.whatsapp;
      if (key === 'telefono') el.textContent = settings.telefono;
      if (key === 'email') el.textContent = settings.email;
      if (key === 'email-virtual') el.textContent = settings.emailVirtual;
      if (key === 'soporte_virtual') el.textContent = settings.soporteVirtual;
    });
    document.querySelectorAll('.dynamic-img').forEach(function (img) {
      var key = img.getAttribute('data-img');
      if (key === 'RECTANGULO') img.src = settings.images.rectangulo;
      if (key === 'WHATSAPP') img.src = settings.images.whatsapp;
      if (key === 'CORREO') img.src = settings.images.correo;
    });
  }

  function buildLocations(config) {
    var root = document.getElementById('locations-root');
    if (!root) return;

    var districts = config.districts.slice();
    var sedesByDistrict = {};
    config.sedes
      .filter(function (s) {
        return s.showOnMap && s.districtId;
      })
      .forEach(function (sede) {
        if (!sedesByDistrict[sede.districtId]) sedesByDistrict[sede.districtId] = [];
        sedesByDistrict[sede.districtId].push(sede);
      });

    districts.forEach(function (district) {
      var sedes = sedesByDistrict[district.id] || [];
      if (!sedes.length) return;

      var districtLi = document.createElement('li');
      districtLi.className = 'district';
      districtLi.textContent = ' ' + district.name;
      districtLi.onclick = function () {
        moveMarker(districtLi, district.slug);
      };
      root.appendChild(districtLi);

      var ul = document.createElement('ul');
      ul.id = district.slug;
      ul.className = 'addresses';
      ul.style.display = 'none';

      sedes.forEach(function (sede) {
        var schoolLi = document.createElement('li');
        schoolLi.className = 'school';
        schoolLi.innerHTML =
          '<img class="dynamic-img" data-img="RECTANGULO" style="height: 20px"> ' +
          esc(sede.nombre);
        schoolLi.onclick = function () {
          selectSchool(sede.lat, sede.lng, sede.slug);
        };
        ul.appendChild(schoolLi);

        var details = document.createElement('div');
        details.id = sede.slug;
        details.className = 'details';
        details.style.display = 'none';
        details.innerHTML =
          (sede.direccion ? '<p>' + esc(sede.direccion) + '</p>' : '') +
          '<div class="info-block"><span style="color:#CF85E3;"><img class="dynamic-img" data-img="RECTANGULO" style="height: 15px"></span><strong>Horario de Atención:</strong></div>' +
          '<p style="padding-left: 25px;">' +
          (sede.horarioHtml || '') +
          '</p>' +
          '<div class="info-block"><span style="color:#CF85E3;"><img class="dynamic-img" data-img="RECTANGULO" style="height: 15px"></span><strong>Información:</strong></div>' +
          '<div class="info-block"><span style="color:#CF85E3;"><img class="dynamic-img" data-img="WHATSAPP" style="height: 23px"></span>' +
          '<p>WhatsApp: <span data-contact="whatsapp"></span><br>Llamadas: <span data-contact="telefono"></span></p></div>' +
          '<div class="info-block"><span style="color:#CF85E3;"><img class="dynamic-img" data-img="CORREO" style="height: 23px"></span><span data-contact="email"></span></div>' +
          '<button type="button" class="brochure-btn">Descargar Brochure</button>';
        var btn = details.querySelector('.brochure-btn');
        btn.onclick = function () {
          window.open(sede.brochureUrl, '_blank');
        };
        ul.appendChild(details);
      });

      root.appendChild(ul);
    });

    applyContacts(config.settings);
  }

  function loadMapsScript(apiKey) {
    if (!apiKey) return;
    var script = document.createElement('script');
    script.src =
      'https://maps.googleapis.com/maps/api/js?key=' +
      encodeURIComponent(apiKey) +
      '&callback=initMap';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }

  document.addEventListener('DOMContentLoaded', function () {
    maliWidgetFetch('/educacion/config')
      .then(function (config) {
        window.__MALI_MAPA_CONFIG__ = config;
        buildLocations(config);
        loadMapsScript(config.settings.mapsApiKey);
      })
      .catch(function (err) {
        console.error('Error cargando mapa', err);
      });
  });
})();
