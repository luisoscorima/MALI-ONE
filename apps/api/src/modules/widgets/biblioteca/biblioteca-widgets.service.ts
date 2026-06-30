import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { UpdateBibliotecaCarouselSettingsDto } from '../dto/biblioteca-carousel-settings.dto';
import { CreateCarouselItemDto, UpdateCarouselItemDto } from '../dto/create-carousel-item.dto';

const DEFAULT_CAROUSEL_SETTINGS = {
  headerTitle: 'CONOCE NUESTRAS NUEVAS ADQUISICIONES',
  headerColor: '#e82323',
};

@Injectable()
export class BibliotecaWidgetsService {
  constructor(private readonly prisma: PrismaService) {}

  getPublicCarouselConfig() {
    return this.ensureCarouselSettings();
  }

  getCarouselSettings() {
    return this.ensureCarouselSettings();
  }

  async updateCarouselSettings(dto: UpdateBibliotecaCarouselSettingsDto) {
    await this.ensureCarouselSettings();
    return this.prisma.bibliotecaCarouselSettings.update({
      where: { id: 'default' },
      data: {
        headerTitle: dto.headerTitle.trim(),
        headerColor: dto.headerColor.toLowerCase(),
      },
    });
  }

  getPublicCarousel() {
    return this.prisma.bibliotecaCarouselItem.findMany({
      where: { activo: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        title: true,
        subtitle: true,
        descriptionHtml: true,
        link: true,
        imageSrc: true,
        imageAlt: true,
        backgroundSrc: true,
      },
    });
  }

  listAdmin() {
    return this.prisma.bibliotecaCarouselItem.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  create(dto: CreateCarouselItemDto) {
    return this.prisma.bibliotecaCarouselItem.create({ data: dto });
  }

  async update(id: string, dto: UpdateCarouselItemDto) {
    await this.find(id);
    return this.prisma.bibliotecaCarouselItem.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.find(id);
    return this.prisma.bibliotecaCarouselItem.delete({ where: { id } });
  }

  private async find(id: string) {
    const row = await this.prisma.bibliotecaCarouselItem.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Ítem no encontrado');
    return row;
  }

  private ensureCarouselSettings() {
    return this.prisma.bibliotecaCarouselSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...DEFAULT_CAROUSEL_SETTINGS },
      update: {},
    });
  }
}
