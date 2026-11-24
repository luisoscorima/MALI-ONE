import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NewsletterScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const createdBySelect = { select: { name: true, email: true } } as const;

export type EmailSenderCatalogScope = NewsletterScope;

@Injectable()
export class EmailSenderService {
  constructor(private readonly prisma: PrismaService) {}

  list(scope?: EmailSenderCatalogScope) {
    return this.prisma.emailSender.findMany({
      where: scope ? { scope } : undefined,
      orderBy: [{ scope: 'asc' }, { email: 'asc' }],
      include: { createdBy: createdBySelect },
    });
  }

  async create(
    rawEmail: string,
    scope: EmailSenderCatalogScope,
    userId?: string,
  ) {
    const email = this.normalize(rawEmail);
    const existing = await this.prisma.emailSender.findUnique({
      where: { scope_email: { scope, email } },
    });
    if (existing) throw new ConflictException('Ese remitente ya está registrado en este catálogo');
    return this.prisma.emailSender.create({
      data: { email, scope, createdById: userId },
      include: { createdBy: createdBySelect },
    });
  }

  async update(id: string, rawEmail: string, scope?: EmailSenderCatalogScope) {
    const email = this.normalize(rawEmail);
    const current = await this.prisma.emailSender.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Remitente no encontrado');
    if (scope && current.scope !== scope) {
      throw new NotFoundException('Remitente no encontrado');
    }
    const duplicate = await this.prisma.emailSender.findFirst({
      where: { email, scope: current.scope, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Ese remitente ya está registrado en este catálogo');
    return this.prisma.emailSender.update({
      where: { id },
      data: { email },
      include: { createdBy: createdBySelect },
    });
  }

  async remove(id: string, scope?: EmailSenderCatalogScope) {
    const current = await this.prisma.emailSender.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Remitente no encontrado');
    if (scope && current.scope !== scope) {
      throw new NotFoundException('Remitente no encontrado');
    }
    const totalInScope = await this.prisma.emailSender.count({
      where: { scope: current.scope },
    });
    if (totalInScope <= 1) {
      throw new BadRequestException(
        'Debe quedar al menos un remitente habilitado en este catálogo',
      );
    }
    await this.prisma.emailSender.delete({ where: { id } });
    return { ok: true };
  }

  async assertEnabled(rawEmail: string, scope: EmailSenderCatalogScope) {
    const email = this.normalize(rawEmail);
    const sender = await this.prisma.emailSender.findUnique({
      where: { scope_email: { scope, email } },
    });
    if (!sender) {
      throw new BadRequestException('El remitente seleccionado no está habilitado en este módulo');
    }
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
