import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { BsaleKardexMovementDto } from '@mali-one/shared';

const COLUMNS = [
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
] as const;

@Injectable()
export class BsaleExportService {
  toCsv(movements: BsaleKardexMovementDto[]): Buffer {
    const escape = (value: unknown): string => {
      const text = value == null ? '' : String(value);
      if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const lines = [
      COLUMNS.map((c) => c.header).join(','),
      ...movements.map((row) =>
        COLUMNS.map((c) => escape(row[c.key])).join(','),
      ),
    ];
    return Buffer.from(`\uFEFF${lines.join('\n')}`, 'utf8');
  }

  async toXlsx(movements: BsaleKardexMovementDto[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MALI ONE';
    const sheet = workbook.addWorksheet('Kardex');
    sheet.columns = COLUMNS.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.max(12, c.header.length + 2),
    }));

    for (const row of movements) {
      sheet.addRow({
        dateIso: row.dateIso,
        officeId: row.officeId,
        officeName: row.officeName,
        movementType: row.movementType,
        documentLabel: row.documentLabel,
        documentNumber: row.documentNumber,
        documentId: row.documentId,
        variantId: row.variantId,
        sku: row.sku,
        productName: row.productName,
        entryQty: row.entryQty,
        exitQty: row.exitQty,
        balanceQty: row.balanceQty,
        unitCost: row.unitCost,
      });
    }

    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
