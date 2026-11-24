const VIEW_IN_BROWSER_LABEL =
  /(?:View(?:\s+this)?\s+email\s+in(?:\s+your)?\s+browser|Ver este correo en el navegador)/i;

/**
 * Removes view-in-browser chrome from stored HTML.
 * Platform injects a single styled block at send time instead.
 */
export function stripViewInBrowserFromHtml(html: string): string {
  let out = html;
  out = out.replace(
    /<div data-mali-view-in-browser\b[^>]*>[\s\S]*?<\/div>/gi,
    '',
  );
  // Anchors whose visible label is the view-in-browser phrase (optional inner spans).
  out = out.replace(
    /<a\b[^>]*>[\s\S]*?<\/a>/gi,
    (full) => (VIEW_IN_BROWSER_LABEL.test(full) ? '' : full),
  );
  // Naked leftover labels if the anchor was already stripped elsewhere.
  out = out.replace(
    /View(?:\s+this)?\s+email\s+in(?:\s+your)?\s+browser/gi,
    '',
  );
  out = out.replace(/Ver este correo en el navegador/gi, '');
  out = out.replace(
    /<p\b[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/p>/gi,
    '',
  );
  return out;
}
