/**
 * SVG animado de formas PAM (triángulo, paralelogramo, hexágono, círculo).
 * filterId debe ser único si hay varias instancias en la misma página.
 */
(function (global) {
  'use strict';

  function getPamShapesSvg(filterId) {
    var glowId = filterId || 'pam-shapes-glow';

    return (
      '<svg viewBox="0 0 280 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<filter id="' + glowId + '" x="-30%" y="-30%" width="160%" height="160%">' +
      '<feGaussianBlur stdDeviation="1.2" result="blur"/>' +
      '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      '</defs>' +
      '<polygon points="35,16 56,56 14,56" fill="none" stroke="#cefa5b" stroke-width="5" stroke-linejoin="round"/>' +
      '<polygon points="35,16 56,56 14,56" fill="none" stroke="white" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" pathLength="100" stroke-dasharray="16 84" filter="url(#' + glowId + ')" opacity="0">' +
      '<animate attributeName="stroke-dashoffset" dur="4.8s" repeatCount="indefinite" values="100;100;0;0;0" keyTimes="0;0.01;0.20;0.23;1"/>' +
      '<animate attributeName="opacity" dur="4.8s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.01;0.20;0.23;1"/>' +
      '</polygon>' +
      '<polygon points="98,14 116,24 98,58 80,48" fill="none" stroke="#1bc469" stroke-width="5" stroke-linejoin="round"/>' +
      '<polygon points="98,14 116,24 98,58 80,48" fill="none" stroke="white" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" pathLength="100" stroke-dasharray="16 84" filter="url(#' + glowId + ')" opacity="0">' +
      '<animate attributeName="stroke-dashoffset" dur="4.8s" repeatCount="indefinite" values="100;100;100;0;0;0" keyTimes="0;0.25;0.26;0.45;0.48;1"/>' +
      '<animate attributeName="opacity" dur="4.8s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.25;0.26;0.45;0.48;1"/>' +
      '</polygon>' +
      '<polygon points="161,18 181,18 193,36 181,54 161,54 149,36" fill="none" stroke="#f7b5b0" stroke-width="5" stroke-linejoin="round"/>' +
      '<polygon points="161,18 181,18 193,36 181,54 161,54 149,36" fill="none" stroke="white" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" pathLength="100" stroke-dasharray="16 84" filter="url(#' + glowId + ')" opacity="0">' +
      '<animate attributeName="stroke-dashoffset" dur="4.8s" repeatCount="indefinite" values="100;100;100;0;0;0" keyTimes="0;0.50;0.51;0.70;0.73;1"/>' +
      '<animate attributeName="opacity" dur="4.8s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.50;0.51;0.70;0.73;1"/>' +
      '</polygon>' +
      '<circle cx="245" cy="36" r="18" fill="none" stroke="#3a5ad0" stroke-width="5"/>' +
      '<circle cx="245" cy="36" r="18" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="16 84" filter="url(#' + glowId + ')" opacity="0">' +
      '<animate attributeName="stroke-dashoffset" dur="4.8s" repeatCount="indefinite" values="100;100;100;0;0;0" keyTimes="0;0.75;0.76;0.95;0.98;1"/>' +
      '<animate attributeName="opacity" dur="4.8s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.75;0.76;0.95;0.98;1"/>' +
      '</circle>' +
      '</svg>'
    );
  }

  global.getPamShapesSvg = getPamShapesSvg;
})(typeof window !== 'undefined' ? window : this);
