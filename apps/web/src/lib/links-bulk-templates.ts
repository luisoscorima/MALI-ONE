import * as XLSX from 'xlsx';

function downloadWorkbook(
  rows: Record<string, string>[],
  sheetName: string,
  filename: string,
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function downloadUrlBulkTemplate() {
  downloadWorkbook(
    [
      {
        url: 'https://ejemplo.com/pagina',
        slug: 'mi-campana',
        tags: 'campana, ventas',
      },
    ],
    'URLs',
    'plantilla-enlaces-url.xlsx',
  );
}

export function downloadWhatsappBulkTemplate() {
  downloadWorkbook(
    [
      {
        telefono: '51987654321',
        mensaje: 'Hola, quiero más información',
        slug: 'wa-ventas',
        tags: 'whatsapp, ventas',
      },
    ],
    'WhatsApp',
    'plantilla-enlaces-whatsapp.xlsx',
  );
}

export function downloadFileUrlBulkTemplate() {
  downloadWorkbook(
    [
      {
        url: 'https://ejemplo.com/archivo.pdf',
        slug: 'catalogo-2026',
        tags: 'archivo, pdf',
      },
    ],
    'URLs de archivo',
    'plantilla-enlaces-archivo-url.xlsx',
  );
}
