import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  UpsertEducacionDistrictDto,
  UpsertEducacionOfertaDto,
  UpsertEducacionSedeDto,
} from './dto/catalog-educacion.dto';

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'sede';
}

function money(value: Prisma.Decimal | null): number | null {
  return value == null ? null : Number(value);
}

@Injectable()
export class CatalogEducacionService {
  constructor(private readonly prisma: PrismaService) {}

  listCursos() {
    return this.prisma.educacionCatalogCurso.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nombre: 'asc' }],
    }).then((rows) => rows.map((row) => this.ofertaDto(row)));
  }

  listProgramas() {
    return this.prisma.educacionCatalogPrograma.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nombre: 'asc' }],
    }).then((rows) => rows.map((row) => this.ofertaDto(row)));
  }

  listSedes() {
    return this.prisma.educacionCatalogSede.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nombre: 'asc' }],
      include: { district: { select: { id: true, name: true } } },
    }).then((rows) => rows.map((row) => this.sedeDto(row)));
  }

  listDistritos() {
    return this.prisma.educacionDistrict.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { sedes: true, catalogSedes: true } },
      },
    }).then((rows) => rows.map((row) => this.districtDto(row)));
  }

  async options() {
    const [cursos, programas, sedes] = await Promise.all([
      this.prisma.educacionCatalogCurso.findMany({
        where: { activo: true },
        orderBy: [{ sortOrder: 'asc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true },
      }),
      this.prisma.educacionCatalogPrograma.findMany({
        where: { activo: true },
        orderBy: [{ sortOrder: 'asc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true },
      }),
      this.prisma.educacionCatalogSede.findMany({
        where: { activo: true },
        orderBy: [{ sortOrder: 'asc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true, slug: true },
      }),
    ]);
    return { cursos, programas, sedes };
  }

  async createCurso(dto: UpsertEducacionOfertaDto) {
    const row = await this.prisma.educacionCatalogCurso.create({
      data: this.ofertaData(dto),
    });
    return this.ofertaDto(row);
  }

  async updateCurso(id: string, dto: UpsertEducacionOfertaDto) {
    await this.ensureCurso(id);
    const row = await this.prisma.educacionCatalogCurso.update({
      where: { id },
      data: this.ofertaData(dto),
    });
    return this.ofertaDto(row);
  }

  async deleteCurso(id: string) {
    await this.ensureCurso(id);
    await this.prisma.educacionCatalogCurso.delete({ where: { id } });
    return { ok: true };
  }

  async createPrograma(dto: UpsertEducacionOfertaDto) {
    const row = await this.prisma.educacionCatalogPrograma.create({
      data: this.ofertaData(dto),
    });
    return this.ofertaDto(row);
  }

  async updatePrograma(id: string, dto: UpsertEducacionOfertaDto) {
    await this.ensurePrograma(id);
    const row = await this.prisma.educacionCatalogPrograma.update({
      where: { id },
      data: this.ofertaData(dto),
    });
    return this.ofertaDto(row);
  }

  async deletePrograma(id: string) {
    await this.ensurePrograma(id);
    await this.prisma.educacionCatalogPrograma.delete({ where: { id } });
    return { ok: true };
  }

  async createSede(dto: UpsertEducacionSedeDto) {
    const districtId = await this.resolveDistrictId(dto.districtId);
    const row = await this.prisma.educacionCatalogSede.create({
      data: {
        ...this.sedeFields(dto),
        districtId,
        slug: await this.uniqueSlug(dto.nombre),
      },
      include: { district: { select: { id: true, name: true } } },
    });
    return this.sedeDto(row);
  }

  async updateSede(id: string, dto: UpsertEducacionSedeDto) {
    await this.ensureSede(id);
    const districtId = await this.resolveDistrictId(dto.districtId);
    const row = await this.prisma.educacionCatalogSede.update({
      where: { id },
      data: { ...this.sedeFields(dto), districtId },
      include: { district: { select: { id: true, name: true } } },
    });
    return this.sedeDto(row);
  }

  async deleteSede(id: string) {
    await this.ensureSede(id);
    await this.prisma.educacionCatalogSede.delete({ where: { id } });
    return { ok: true };
  }

  async createDistrito(dto: UpsertEducacionDistrictDto) {
    const nombre = dto.nombre.trim();
    const max = await this.prisma.educacionDistrict.aggregate({ _max: { sortOrder: true } });
    const row = await this.prisma.educacionDistrict.create({
      data: {
        name: nombre,
        slug: await this.uniqueDistrictSlug(nombre),
        sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
      include: { _count: { select: { sedes: true, catalogSedes: true } } },
    });
    return this.districtDto(row);
  }

  async updateDistrito(id: string, dto: UpsertEducacionDistrictDto) {
    await this.ensureDistrito(id);
    const row = await this.prisma.educacionDistrict.update({
      where: { id },
      data: {
        name: dto.nombre.trim(),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: { _count: { select: { sedes: true, catalogSedes: true } } },
    });
    return this.districtDto(row);
  }

  async deleteDistrito(id: string) {
    const row = await this.prisma.educacionDistrict.findUnique({
      where: { id },
      include: { _count: { select: { sedes: true, catalogSedes: true } } },
    });
    if (!row) throw new NotFoundException('Distrito no encontrado');
    if (row._count.sedes + row._count.catalogSedes > 0) {
      throw new BadRequestException('Este distrito todavía tiene sedes. Cámbialas de distrito antes de eliminarlo.');
    }
    await this.prisma.educacionDistrict.delete({ where: { id } });
    return { ok: true };
  }

  private ofertaData(dto: UpsertEducacionOfertaDto): Prisma.EducacionCatalogCursoCreateInput {
    return {
      nombre: dto.nombre.trim(),
      precio: dto.precio == null ? null : new Prisma.Decimal(dto.precio),
      descuento: emptyToNull(dto.descuento),
      horario: emptyToNull(dto.horario),
      activo: dto.activo ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };
  }

  private sedeFields(dto: UpsertEducacionSedeDto) {
    return {
      nombre: dto.nombre.trim(),
      direccion: emptyToNull(dto.direccion),
      brochureUrl: emptyToNull(dto.brochureUrl),
      icon: emptyToNull(dto.icon) || 'location_on',
      horarioHtml: emptyToNull(dto.horarioHtml),
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      showOnSelector: dto.showOnSelector ?? true,
      showOnMap: dto.showOnMap ?? false,
      activo: dto.activo ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };
  }

  private async uniqueSlug(nombre: string) {
    const base = slugify(nombre);
    let slug = base;
    let n = 2;
    while (
      await this.prisma.educacionCatalogSede.findFirst({
        where: { slug },
        select: { id: true },
      })
    ) {
      slug = `${base}-${n}`;
      n += 1;
    }
    return slug;
  }

  private ofertaDto(row: {
    id: string;
    nombre: string;
    precio: Prisma.Decimal | null;
    descuento: string | null;
    horario: string | null;
    activo: boolean;
    sortOrder: number;
  }) {
    return {
      id: row.id,
      nombre: row.nombre,
      precio: money(row.precio),
      descuento: row.descuento,
      horario: row.horario,
      activo: row.activo,
      sortOrder: row.sortOrder,
    };
  }

  private sedeDto(row: {
    id: string;
    slug: string;
    nombre: string;
    direccion: string | null;
    brochureUrl: string | null;
    icon: string;
    horarioHtml: string | null;
    lat: number | null;
    lng: number | null;
    showOnSelector: boolean;
    showOnMap: boolean;
    activo: boolean;
    sortOrder: number;
    district?: { id: string; name: string } | null;
  }) {
    return {
      id: row.id,
      slug: row.slug,
      nombre: row.nombre,
      direccion: row.direccion,
      brochureUrl: row.brochureUrl,
      icon: row.icon,
      horarioHtml: row.horarioHtml,
      lat: row.lat,
      lng: row.lng,
      districtId: row.district?.id ?? null,
      distrito: row.district ? { id: row.district.id, nombre: row.district.name } : null,
      showOnSelector: row.showOnSelector,
      showOnMap: row.showOnMap,
      activo: row.activo,
      sortOrder: row.sortOrder,
    };
  }

  private districtDto(row: {
    id: string;
    name: string;
    slug: string;
    sortOrder: number;
    _count: { sedes: number; catalogSedes: number };
  }) {
    return {
      id: row.id,
      nombre: row.name,
      slug: row.slug,
      sortOrder: row.sortOrder,
      sedes: row._count.sedes + row._count.catalogSedes,
    };
  }

  private async resolveDistrictId(value: string | null | undefined) {
    const id = emptyToNull(value);
    if (!id) return null;
    const row = await this.prisma.educacionDistrict.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new BadRequestException('El distrito no está en el catálogo');
    return id;
  }

  private async uniqueDistrictSlug(nombre: string) {
    const base = slugify(nombre);
    let slug = base;
    let n = 2;
    while (
      await this.prisma.educacionDistrict.findFirst({
        where: { slug },
        select: { id: true },
      })
    ) {
      slug = `${base}-${n}`;
      n += 1;
    }
    return slug;
  }

  private async ensureDistrito(id: string) {
    const row = await this.prisma.educacionDistrict.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Distrito no encontrado');
  }

  private async ensureCurso(id: string) {
    const row = await this.prisma.educacionCatalogCurso.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Curso no encontrado');
  }

  private async ensurePrograma(id: string) {
    const row = await this.prisma.educacionCatalogPrograma.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Programa no encontrado');
  }

  private async ensureSede(id: string) {
    const row = await this.prisma.educacionCatalogSede.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Sede no encontrada');
  }
}
