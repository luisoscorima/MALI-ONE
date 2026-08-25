import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EducacionLead } from '@prisma/client';
import { existsSync, readFileSync, statSync } from 'fs';
import { google } from 'googleapis';

/** Destino del espejo Sheet (transitorio). */
export type EducacionSheetBucket = 'ep' | 'ca' | 'diseno';

/**
 * Espejo transitorio hacia Google Sheets de leads Educación.
 * Apagar con EDUCACION_LEADS_SHEETS_ENABLED=false cuando CRM Educación reemplace el Sheet.
 *
 * - Libro EP: `GOOGLE_SHEETS_LEADS_EP_ID` (ID o URL completa)
 * - Libro CA: `GOOGLE_SHEETS_LEADS_CA_ID` (ID o URL completa)
 * - Libro Diseño y Comunicaciones: `GOOGLE_SHEETS_LEADS_DISENO_ID` (ID o URL; aparte)
 *
 * Columnas (append):
 * Fecha | Nombres | Apellidos | DNI | Celular | Correo |
 * Curso | Fuente | Source | URL | OptIn Marketing | Lead ID | Bucket
 */
@Injectable()
export class EducacionLeadsSheetsService {
  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    const raw = String(
      this.config.get('EDUCACION_LEADS_SHEETS_ENABLED') ?? '',
    )
      .trim()
      .toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  }

  /**
   * EP clásico (/extensionprofesional/…) → ep
   * Diseño y Comunicaciones (/diseno-y-comunicaciones/…) → diseno
   * Cursos de Arte → ca
   */
  resolveBucket(lead: EducacionLead): EducacionSheetBucket {
    const url = String(lead.pageUrl ?? '').toLowerCase();
    if (url.includes('/diseno-y-comunicaciones/')) {
      return 'diseno';
    }
    if (lead.whatsappArea === 'educacion_ca') {
      return 'ca';
    }
    return 'ep';
  }

  async appendLead(lead: EducacionLead): Promise<void> {
    if (!this.enabled) {
      throw new Error('Sheets mirror disabled');
    }

    const bucket = this.resolveBucket(lead);
    const { spreadsheetId, tab } = this.resolveTarget(bucket);

    if (!spreadsheetId) {
      const envByBucket: Record<EducacionSheetBucket, string> = {
        ep: 'GOOGLE_SHEETS_LEADS_EP_ID',
        ca: 'GOOGLE_SHEETS_LEADS_CA_ID',
        diseno: 'GOOGLE_SHEETS_LEADS_DISENO_ID',
      };
      throw new Error(`${envByBucket[bucket]} no configurado`);
    }

    const sheets = this.getSheetsClient();
    const fecha = lead.createdAt.toISOString().slice(0, 19).replace('T', ' ');
    const range = `'${tab.replace(/'/g, "''")}'!A:M`;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [
          [
            fecha,
            lead.nombres,
            lead.apellidos,
            lead.dni ?? '',
            lead.celular,
            lead.email ?? '',
            lead.courseTitle ?? lead.courseSlug ?? '',
            lead.fuente,
            lead.source,
            lead.pageUrl ?? '',
            lead.optInMarketing ? 'SI' : 'NO',
            lead.id,
            bucket,
          ],
        ],
      },
    });
  }

  private resolveTarget(bucket: EducacionSheetBucket): {
    spreadsheetId: string;
    tab: string;
  } {
    if (bucket === 'diseno') {
      return {
        spreadsheetId: this.parseSpreadsheetRef(
          this.config.get('GOOGLE_SHEETS_LEADS_DISENO_ID'),
        ),
        tab: this.tabName('GOOGLE_SHEETS_LEADS_TAB_DISENO', 'Diseno'),
      };
    }
    if (bucket === 'ca') {
      return {
        spreadsheetId: this.parseSpreadsheetRef(
          this.config.get('GOOGLE_SHEETS_LEADS_CA_ID'),
        ),
        tab: this.tabName('GOOGLE_SHEETS_LEADS_TAB_CA', 'CA'),
      };
    }
    return {
      spreadsheetId: this.parseSpreadsheetRef(
        this.config.get('GOOGLE_SHEETS_LEADS_EP_ID'),
      ),
      tab: this.tabName('GOOGLE_SHEETS_LEADS_TAB_EP', 'EP'),
    };
  }

  private tabName(envKey: string, fallback: string): string {
    const raw = String(this.config.get(envKey) ?? '')
      .trim()
      .replace(/^'+|'+$/g, '');
    return raw || fallback;
  }

  /** Acepta ID crudo o URL de Google Sheets. */
  private parseSpreadsheetRef(raw: unknown): string {
    const value = String(raw ?? '').trim();
    if (!value) return '';
    const fromUrl = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (fromUrl?.[1]) return fromUrl[1];
    return value;
  }

  private getSheetsClient() {
    const jsonPath =
      this.config.get<string>('GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_PATH') ||
      this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON_PATH');

    if (!jsonPath) {
      throw new Error(
        'Define GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_PATH o GOOGLE_SERVICE_ACCOUNT_JSON_PATH',
      );
    }
    if (!existsSync(jsonPath) || !statSync(jsonPath).isFile()) {
      throw new Error(`Service account JSON no encontrado: ${jsonPath}`);
    }

    const credentials = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
      client_email?: string;
      private_key?: string;
    };
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('JSON de service account incompleto');
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
  }
}
