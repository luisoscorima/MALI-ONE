import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { UpdateEducacionSettingsDto } from '../dto/update-educacion-settings.dto';
import {
  CreateEducacionDistrictDto,
  UpdateEducacionDistrictDto,
} from '../dto/create-educacion-district.dto';
import {
  CreateEducacionSedeDto,
  UpdateEducacionSedeDto,
} from '../dto/create-educacion-sede.dto';
import {
  CreateEducacionSelectorSedeDto,
  UpdateEducacionSelectorSedeDto,
} from '../dto/create-educacion-selector-sede.dto';
import { UpdateEducacionPopupDto } from '../dto/update-educacion-popup.dto';
import {
  CreateEducacionAliadoDto,
  UpdateEducacionAliadoDto,
} from '../dto/create-educacion-aliado.dto';
import { buildPopupPublicConfig, POPUP_TIMING } from '../popup-schedule.util';
import {
  EDUCACION_ASSET_URLS,
  resolveEducacionImage,
} from './educacion-asset-urls';

const DEFAULT_CALENDAR_ID = 'talleresmali@mali.pe';

const DEFAULT_POPUP = {
  activo: false,
  imagenUrl: '',
  imagenLinkUrl: null as string | null,
  imagenTarget: '_blank',
  titulo: null as string | null,
  botonTexto: 'Ver más',
  botonUrl: '',
  botonTarget: '_blank',
  showOnce: false,
  delayMs: POPUP_TIMING.delayMs,
  animationSpeedMs: POPUP_TIMING.animationSpeedMs,
  scheduleEnabled: false,
  scheduleDateStart: null as string | null,
  scheduleDateEnd: null as string | null,
  scheduleTimeStart: null as string | null,
  scheduleTimeEnd: null as string | null,
  scheduleTimezone: 'America/Lima',
};

@Injectable()
export class EducacionWidgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getPublicConfig() {
    const [settings, districts, sedes] = await Promise.all([
      this.ensureSettings(),
      this.prisma.educacionDistrict.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.educacionSede.findMany({
        where: { activo: true, showOnMap: true },
        orderBy: { sortOrder: 'asc' },
        include: { district: true },
      }),
    ]);

    const mapsApiKey =
      settings.mapsApiKey ??
      this.config.get<string>('GOOGLE_MAPS_API_KEY') ??
      null;

    return {
      settings: {
        whatsapp: settings.whatsapp,
        telefono: settings.telefono,
        email: settings.email,
        emailVirtual: settings.emailVirtual,
        soporteVirtual: settings.soporteVirtual,
        images: {
          rectangulo: resolveEducacionImage(
            settings.imageRectangulo,
            'rectangulo',
          ),
          whatsapp: resolveEducacionImage(settings.imageWhatsapp, 'whatsapp'),
          circulo: resolveEducacionImage(settings.imageCirculo, 'circulo'),
          correo: resolveEducacionImage(settings.imageCorreo, 'correo'),
          marker: resolveEducacionImage(settings.imageMarker, 'marker'),
        },
        mapsApiKey,
      },
      districts: districts.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        sortOrder: d.sortOrder,
      })),
      sedes: sedes.map((s) => this.mapSedePublic(s)),
    };
  }

  async getSelectorPublicConfig() {
    const sedes = await this.prisma.educacionSelectorSede.findMany({
      where: { activo: true },
      orderBy: { sortOrder: 'asc' },
    });
    return {
      sedes: sedes.map((s) => ({
        id: s.id,
        slug: s.slug,
        nombre: s.nombre,
        brochureUrl: s.brochureUrl,
        icon: s.icon,
        sortOrder: s.sortOrder,
      })),
    };
  }

  async getCalendarPublicConfig() {
    const settings = await this.ensureSettings();
    const apiKey = this.config.get<string>('GOOGLE_CALENDAR_API_KEY') ?? null;
    return {
      calendarId: settings.googleCalendarId?.trim() || DEFAULT_CALENDAR_ID,
      apiKey,
    };
  }

  async getCalendarEvents(month: number, year: number) {
    const settings = await this.ensureSettings();
    const apiKey = this.config.get<string>('GOOGLE_CALENDAR_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GOOGLE_CALENDAR_API_KEY no configurada en el servidor',
      );
    }

    const calendarId =
      settings.googleCalendarId?.trim() || DEFAULT_CALENDAR_ID;
    const firstDay = new Date(year, month - 1, 1).toISOString();
    const lastDay = new Date(year, month, 0, 23, 59, 59).toISOString();
    const url =
      'https://www.googleapis.com/calendar/v3/calendars/' +
      encodeURIComponent(calendarId) +
      '/events?key=' +
      encodeURIComponent(apiKey) +
      '&timeMin=' +
      encodeURIComponent(firstDay) +
      '&timeMax=' +
      encodeURIComponent(lastDay) +
      '&singleEvents=true&orderBy=startTime';

    const res = await fetch(url);
    const body = (await res.json()) as { items?: unknown[]; error?: { message?: string } };
    if (!res.ok) {
      throw new BadGatewayException(
        body.error?.message ?? 'No se pudo cargar el calendario de Google',
      );
    }
    return body;
  }

  async getPopupPublicConfig() {
    const popup = await this.ensurePopup();
    return buildPopupPublicConfig(popup);
  }

  async getAliadosPublicConfig() {
    const aliados = await this.prisma.educacionAliado.findMany({
      where: { activo: true },
      orderBy: { sortOrder: 'asc' },
    });
    return {
      aliados: aliados.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        imageUrl: a.imageUrl,
        categoria: a.categoria,
        url: a.url,
        sortOrder: a.sortOrder,
      })),
    };
  }

  async getAdminState() {
    const [settings, districts, sedes, selectorSedes, popup, aliados] =
      await Promise.all([
      this.ensureSettings(),
      this.prisma.educacionDistrict.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { sedes: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.educacionSede.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { district: true },
      }),
      this.prisma.educacionSelectorSede.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      this.ensurePopup(),
      this.prisma.educacionAliado.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    return { settings, districts, sedes, selectorSedes, popup, aliados };
  }

  async updateSettings(dto: UpdateEducacionSettingsDto) {
    await this.ensureSettings();
    return this.prisma.educacionWidgetSettings.update({
      where: { id: 'default' },
      data: dto,
    });
  }

  createDistrict(dto: CreateEducacionDistrictDto) {
    return this.prisma.educacionDistrict.create({ data: dto });
  }

  async updateDistrict(id: string, dto: UpdateEducacionDistrictDto) {
    await this.findDistrict(id);
    return this.prisma.educacionDistrict.update({ where: { id }, data: dto });
  }

  async deleteDistrict(id: string) {
    await this.findDistrict(id);
    await this.prisma.educacionSede.updateMany({
      where: { districtId: id },
      data: { districtId: null },
    });
    return this.prisma.educacionDistrict.delete({ where: { id } });
  }

  createSede(dto: CreateEducacionSedeDto) {
    return this.prisma.educacionSede.create({ data: dto });
  }

  async updateSede(id: string, dto: UpdateEducacionSedeDto) {
    await this.findSede(id);
    return this.prisma.educacionSede.update({ where: { id }, data: dto });
  }

  async deleteSede(id: string) {
    await this.findSede(id);
    return this.prisma.educacionSede.delete({ where: { id } });
  }

  createSelectorSede(dto: CreateEducacionSelectorSedeDto) {
    return this.prisma.educacionSelectorSede.create({ data: dto });
  }

  async updateSelectorSede(id: string, dto: UpdateEducacionSelectorSedeDto) {
    await this.findSelectorSede(id);
    return this.prisma.educacionSelectorSede.update({ where: { id }, data: dto });
  }

  async deleteSelectorSede(id: string) {
    await this.findSelectorSede(id);
    return this.prisma.educacionSelectorSede.delete({ where: { id } });
  }

  async updatePopup(dto: UpdateEducacionPopupDto) {
    await this.ensurePopup();
    return this.prisma.educacionPopupSettings.update({
      where: { id: 'default' },
      data: dto,
    });
  }

  createAliado(dto: CreateEducacionAliadoDto) {
    return this.prisma.educacionAliado.create({ data: dto });
  }

  async updateAliado(id: string, dto: UpdateEducacionAliadoDto) {
    await this.findAliado(id);
    return this.prisma.educacionAliado.update({ where: { id }, data: dto });
  }

  async deleteAliado(id: string) {
    await this.findAliado(id);
    return this.prisma.educacionAliado.delete({ where: { id } });
  }

  async importAliados(
    items: {
      nombre: string;
      imagen?: string;
      imageUrl?: string;
      categoria: string;
      url?: string | null;
      sortOrder?: number;
    }[],
    replace = true,
  ) {
    const importedNames = new Set<string>();
    let upserted = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const nombre = item.nombre?.trim();
      const imageUrl = (item.imageUrl ?? item.imagen ?? '').trim();
      if (!nombre || !imageUrl) continue;

      importedNames.add(nombre);
      const data = {
        nombre,
        imageUrl,
        categoria: item.categoria,
        url: item.url?.trim() || null,
        sortOrder: item.sortOrder ?? i,
        activo: true,
      };

      const existing = await this.prisma.educacionAliado.findFirst({
        where: { nombre },
      });

      if (existing) {
        await this.prisma.educacionAliado.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.educacionAliado.create({ data });
      }
      upserted += 1;
    }

    if (replace && importedNames.size > 0) {
      await this.prisma.educacionAliado.updateMany({
        where: { nombre: { notIn: [...importedNames] } },
        data: { activo: false },
      });
    }

    return { upserted, total: importedNames.size };
  }

  private mapSedePublic(
    s: {
      id: string;
      slug: string;
      nombre: string;
      direccion: string | null;
      lat: number | null;
      lng: number | null;
      horarioHtml: string | null;
      brochureUrl: string;
      districtId: string | null;
      showOnMap: boolean;
      sortOrder: number;
      district?: { slug: string } | null;
    },
  ) {
    return {
      id: s.id,
      slug: s.slug,
      nombre: s.nombre,
      direccion: s.direccion,
      lat: s.lat,
      lng: s.lng,
      horarioHtml: s.horarioHtml,
      brochureUrl: s.brochureUrl,
      districtId: s.districtId,
      districtSlug: s.district?.slug ?? null,
      showOnMap: s.showOnMap,
      sortOrder: s.sortOrder,
    };
  }

  private async ensureSettings() {
    return this.prisma.educacionWidgetSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        whatsapp: '',
        telefono: '',
        email: '',
        emailVirtual: '',
        soporteVirtual: '',
        imageRectangulo: EDUCACION_ASSET_URLS.rectangulo,
        imageWhatsapp: EDUCACION_ASSET_URLS.whatsapp,
        imageCirculo: EDUCACION_ASSET_URLS.circulo,
        imageCorreo: EDUCACION_ASSET_URLS.correo,
        imageMarker: EDUCACION_ASSET_URLS.marker,
        googleCalendarId: DEFAULT_CALENDAR_ID,
      },
      update: {},
    });
  }

  private async ensurePopup() {
    return this.prisma.educacionPopupSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...DEFAULT_POPUP },
      update: {},
    });
  }

  private async findDistrict(id: string) {
    const row = await this.prisma.educacionDistrict.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Distrito no encontrado');
    return row;
  }

  private async findSede(id: string) {
    const row = await this.prisma.educacionSede.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Sede no encontrada');
    return row;
  }

  private async findSelectorSede(id: string) {
    const row = await this.prisma.educacionSelectorSede.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Sede del selector no encontrada');
    return row;
  }

  private async findAliado(id: string) {
    const row = await this.prisma.educacionAliado.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Aliado no encontrado');
    return row;
  }
}
