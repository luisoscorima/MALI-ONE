import { Injectable, NotFoundException } from '@nestjs/common';
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
        where: { activo: true },
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
          rectangulo: settings.imageRectangulo,
          whatsapp: settings.imageWhatsapp,
          correo: settings.imageCorreo,
        },
        mapsApiKey,
      },
      districts: districts.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        sortOrder: d.sortOrder,
      })),
      sedes: sedes.map((s) => ({
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
        showOnSelector: s.showOnSelector,
        sortOrder: s.sortOrder,
      })),
    };
  }

  async getAdminState() {
    const [settings, districts, sedes] = await Promise.all([
      this.ensureSettings(),
      this.prisma.educacionDistrict.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { sedes: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.educacionSede.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { district: true },
      }),
    ]);
    return { settings, districts, sedes };
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
        imageRectangulo: '',
        imageWhatsapp: '',
        imageCorreo: '',
      },
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
}
