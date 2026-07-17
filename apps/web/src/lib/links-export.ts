import * as XLSX from 'xlsx';
import type { ShortLinkDto } from '@mali-one/shared';

function toExportRows(links: ShortLinkDto[]) {
  return links.map((link) => ({
    Slug: link.slug,
    'URL corta': link.shortUrl,
    Destino: link.targetUrl,
    Tipo: link.type,
    Tags: link.tags.join(', '),
    Clicks: link.clickCount,
    'Fecha creación': link.createdAt,
    Archivo: link.fileName ?? '',
  }));
}

export function downloadLinksExcel(links: ShortLinkDto[]) {
  if (links.length === 0) {
    throw new Error('No hay enlaces para exportar');
  }

  const rows = toExportRows(links);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Enlaces');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `links-${stamp}.xlsx`);
}
