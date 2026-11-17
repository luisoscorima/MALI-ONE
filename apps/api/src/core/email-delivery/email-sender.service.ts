import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailSenderService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.emailSender.findMany({ orderBy: { email: 'asc' } });
  }

  async create(rawEmail: string) {
    const email = this.normalize(rawEmail);
    const existing = await this.prisma.emailSender.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Ese remitente ya está registrado');
    return this.prisma.emailSender.create({ data: { email } });
  }

  async update(id: string, rawEmail: string) {
    const email = this.normalize(rawEmail);
    const current = await this.prisma.emailSender.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Remitente no encontrado');
    const duplicate = await this.prisma.emailSender.findFirst({
      where: { email, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Ese remitente ya está registrado');
    return this.prisma.emailSender.update({ where: { id }, data: { email } });
  }

  async remove(id: string) {
    const current = await this.prisma.emailSender.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Remitente no encontrado');
    const total = await this.prisma.emailSender.count();
    if (total <= 1) {
      throw new BadRequestException('Debe quedar al menos un remitente habilitado');
    }
    await this.prisma.emailSender.delete({ where: { id } });
    return { ok: true };
  }

  async assertEnabled(rawEmail: string) {
    const email = this.normalize(rawEmail);
    const sender = await this.prisma.emailSender.findUnique({ where: { email } });
    if (!sender) throw new BadRequestException('El remitente seleccionado no está habilitado');
    return sender;
  }

  private normalize(rawEmail: string): string {
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^@\s]+@mali\.pe$/.test(email)) {
      throw new BadRequestException('El remitente debe ser un correo @mali.pe');
    }
    return email;
  }
}
