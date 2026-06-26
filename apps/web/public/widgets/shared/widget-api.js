window.MALI_WIDGET_API =
  window.MALI_WIDGET_API || location.origin + '/api/widgets';

window.maliWidgetFetch = function maliWidgetFetch(path) {
  return fetch(window.MALI_WIDGET_API + path).then(function (res) {
    if (!res.ok) throw new Error('No se pudo cargar ' + path);
    return res.json();
  });
};
