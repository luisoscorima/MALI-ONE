import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { CreateCarouselItemDto, UpdateCarouselItemDto } from '../dto/create-carousel-item.dto';

@Injectable()
export class BibliotecaWidgetsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
