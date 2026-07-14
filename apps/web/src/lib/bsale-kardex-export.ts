import * as XLSX from 'xlsx';
import type { BsaleKardexMovementDto } from '@mali-one/shared';

const COLUMNS: { key: keyof BsaleKardexMovementDto; header: string }[] = [
  { key: 'dateIso', header: 'Fecha' },
  { key: 'officeId', header: 'Almacen ID' },
  { key: 'officeName', header: 'Almacen' },
  { key: 'movementType', header: 'Tipo movimiento' },
  { key: 'documentLabel', header: 'Documento' },
  { key: 'documentNumber', header: 'Folio' },
  { key: 'documentId', header: 'Documento ID' },
  { key: 'variantId', header: 'Variante ID' },
  { key: 'sku', header: 'SKU' },
  { key: 'productName', header: 'Producto' },
  { key: 'entryQty', header: 'Entrada' },
  { key: 'exitQty', header: 'Salida' },
  { key: 'balanceQty', header: 'Saldo' },
  { key: 'unitCost', header: 'Costo unitario' },
];

function toExportRows(movements: BsaleKardexMovementDto[]) {
  return movements.map((row) => {
    const out: Record<string, string | number | null> = {};
    for (const col of COLUMNS) {
      out[col.header] = row[col.key] as string | number | null;
    }
    return out;
  });
}

export function downloadKardexCsv(
  movements: BsaleKardexMovementDto[],
  from: string,
  to: string,
) {
  const rows = toExportRows(movements);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kardex_bsale_${from}_${to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadKardexXlsx(
  movements: BsaleKardexMovementDto[],
  from: string,
  to: string,
) {
  const rows = toExportRows(movements);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kardex');
  XLSX.writeFile(wb, `kardex_bsale_${from}_${to}.xlsx`);
}
