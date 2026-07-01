import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PamEmailStatus, PamMpStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RedisService } from '../../../core/redis/redis.service';
import {
  CreatePamPlanDto,
  CreatePamRegistrationDto,
  UpdatePamPlanDto,
  UpdatePamRegistrationDto,
  UpdatePamSettingsDto,
} from '../dto/pam.dto';
import { UpdateMuseoPopupDto } from '../dto/update-museo-popup.dto';
import { buildPopupPublicConfig } from '../popup-schedule.util';
import { PamEmailService } from './pam-email.service';

const MP_CONFIRMED: PamMpStatus[] = ['approved', 'authorized'];

const DEFAULT_MUSEO_POPUP = {
  activo: false,
  imagenUrl: '',
  imagenLinkUrl: null as string | null,
  imagenTarget: '_blank',
  titulo: null as string | null,
  botonTexto: 'Ver más',
  botonUrl: '',
  botonTarget: '_blank',
  showOnce: false,
  delayMs: 800,
  animationSpeedMs: 300,
  scheduleEnabled: false,
  scheduleDateStart: null as string | null,
  scheduleDateEnd: null as string | null,
  scheduleTimeStart: null as string | null,
  scheduleTimeEnd: null as string | null,
  scheduleTimezone: 'America/Lima',
};

@Injectable()
export class PamWidgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly email: PamEmailService,
  ) {}

  async getPublicConfig() {
    const [settings, plans] = await Promise.all([
      this.ensureSettings(),
      this.prisma.pamPlan.findMany({
        where: { activo: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    return {
      benefits: settings.benefits as string[],
      notes: settings.notes as string[],
      plans: plans.map((p) => ({
        id: p.slug,
        name: p.name,
        color: p.color,
        exclusive: p.exclusive,
        monthly: {
          price: p.monthlyPrice,
          duration: p.monthlyDuration,
          checkout: p.monthlyCheckout,
          values: p.monthlyValues as string[],
        },
        yearly: {
          price: p.yearlyPrice,
          duration: p.yearlyDuration,
          checkout: p.yearlyCheckout,
          values: p.yearlyValues as string[],
        },
      })),
    };
  }

  async getSettings() {
    return this.ensureSettings();
  }

  listPlans() {
    return this.prisma.pamPlan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  getMuseoPopupAdmin() {
    return this.ensureMuseoPopup();
  }

  async updateSettings(dto: UpdatePamSettingsDto) {
    await this.ensureSettings();
    return this.prisma.pamWidgetSettings.update({
      where: { id: 'default' },
      data: {
        benefits: dto.benefits,
        notes: dto.notes,
      },
    });
  }

  async getMuseoPopupPublicConfig() {
    const popup = await this.ensureMuseoPopup();
    return buildPopupPublicConfig(popup);
  }

  async updateMuseoPopup(dto: UpdateMuseoPopupDto) {
    await this.ensureMuseoPopup();
    return this.prisma.museoPopupSettings.update({
      where: { id: 'default' },
      data: dto,
    });
  }

  createPlan(dto: CreatePamPlanDto) {
    return this.prisma.pamPlan.create({ data: dto });
  }

  async updatePlan(id: string, dto: UpdatePamPlanDto) {
    await this.findPlan(id);
    return this.prisma.pamPlan.update({ where: { id }, data: dto });
  }

  async deletePlan(id: string) {
    await this.findPlan(id);
    return this.prisma.pamPlan.delete({ where: { id } });
  }

  listRegistrations() {
    return this.prisma.pamRegistration.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRegistration(id: string, dto: UpdatePamRegistrationDto) {
    const existing = await this.findRegistration(id);
    const data: Prisma.PamRegistrationUpdateInput = {};

    const stringFields = [
      'nombres',
      'apellidos',
      'dni',
      'celular',
      'correo',
      'direccion',
      'ciudad',
      'distrito',
      'genero',
      'fechaNacimiento',
      'comoTeEnteraste',
      'plan',
      'frecuencia',
      'checkoutUrl',
    ] as const;

    for (const field of stringFields) {
      if (dto[field] !== undefined) {
        data[field] = dto[field];
      }
    }

    if (dto.aceptaPrivacidad !== undefined) {
      data.aceptaPrivacidad = dto.aceptaPrivacidad;
    }

    if (dto.welcomeEmail !== undefined) {
      data.welcomeEmail = dto.welcomeEmail as PamEmailStatus;
    }

    if (dto.expiryNotice !== undefined) {
      data.expiryNotice = dto.expiryNotice as PamEmailStatus;
    }

    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    }

    const mpStatusChanging = dto.mpStatus !== undefined;
    if (mpStatusChanging) {
      data.mpStatus =
        dto.mpStatus === '' ? null : (dto.mpStatus as PamMpStatus);
    }

    const frecuencia = dto.frecuencia ?? existing.frecuencia;
    const effectiveMp = mpStatusChanging
      ? dto.mpStatus === ''
        ? null
        : (dto.mpStatus as PamMpStatus)
      : existing.mpStatus;

    if (
      effectiveMp &&
      MP_CONFIRMED.includes(effectiveMp) &&
      dto.expiryDate === undefined &&
      !existing.expiryDate
    ) {
      data.expiryDate = this.calculateExpiryDate(existing.createdAt, frecuencia);
    }

    const updated = await this.prisma.pamRegistration.update({
      where: { id },
      data,
    });

    const wasConfirmed =
      existing.mpStatus != null && MP_CONFIRMED.includes(existing.mpStatus);
    const nowConfirmed =
      updated.mpStatus != null && MP_CONFIRMED.includes(updated.mpStatus);

    if (nowConfirmed && (!wasConfirmed || mpStatusChanging)) {
      await this.email.sendWelcomeIfNeeded(updated.id);
    }

    return updated;
  }

  async resendWelcome(id: string) {
    const reg = await this.findRegistration(id);
    if (!reg.mpStatus || !MP_CONFIRMED.includes(reg.mpStatus)) {
      throw new BadRequestException(
        'Solo se puede reenviar la bienvenida con pago confirmado (approved/authorized)',
      );
    }
    await this.email.resendWelcome(reg);
    return this.findRegistration(id);
  }

  async createRegistration(dto: CreatePamRegistrationDto, ip: string) {
    const key = `pam:reg:${ip}`;
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, 3600);
    }
    if (count > 10) {
      throw new BadRequestException('Demasiados intentos. Intenta más tarde.');
    }

    if (!dto.aceptaPrivacidad) {
      throw new BadRequestException('Debes aceptar la política de privacidad');
    }

    return this.prisma.pamRegistration.create({
      data: {
        nombres: dto.nombres,
        apellidos: dto.apellidos,
        dni: dto.dni,
        celular: dto.celular,
        correo: dto.correo,
        direccion: dto.direccion,
        ciudad: dto.ciudad,
        distrito: dto.distrito,
        genero: dto.genero,
        fechaNacimiento: dto.fechaNacimiento,
        comoTeEnteraste: dto.comoTeEnteraste,
        plan: dto.plan,
        frecuencia: dto.frecuencia,
        checkoutUrl: dto.checkoutUrl,
        aceptaPrivacidad: dto.aceptaPrivacidad,
      },
    });
  }

  async handleMercadoPagoWebhook(body: Record<string, unknown>) {
    const data = (body.data as Record<string, unknown>) ?? body;
    const id =
      (data.id as string) ??
      (body.id as string) ??
      (data['preapproval_id'] as string);
    const status = String(
      data.status ?? body.status ?? body['payment_status'] ?? '',
    ).toLowerCase() as PamMpStatus;

    if (!id) {
      return { ok: false, reason: 'missing_id' };
    }

    const registration = await this.prisma.pamRegistration.findFirst({
      where: {
        OR: [
          { checkoutUrl: { contains: String(id) } },
          { id: String(id) },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!registration) {
      return { ok: false, reason: 'registration_not_found' };
    }

    const mpStatus = this.normalizeMpStatus(status);
    const update: Prisma.PamRegistrationUpdateInput = { mpStatus };

    if (mpStatus && MP_CONFIRMED.includes(mpStatus)) {
      const expiryDate = this.calculateExpiryDate(
        registration.createdAt,
        registration.frecuencia,
      );
      update.expiryDate = expiryDate;
    }

    const updated = await this.prisma.pamRegistration.update({
      where: { id: registration.id },
      data: update,
    });

    if (mpStatus && MP_CONFIRMED.includes(mpStatus)) {
      await this.email.sendWelcomeIfNeeded(updated.id);
    }

    return { ok: true };
  }

  async processPendingEmails() {
    await this.email.sendPendingWelcomeEmails();
    await this.email.sendPendingExpiryNotices();
  }

  private calculateExpiryDate(createdAt: Date, frecuencia: string) {
    const date = new Date(createdAt);
    if (frecuencia.toLowerCase().includes('año') || frecuencia === 'yearly') {
      date.setFullYear(date.getFullYear() + 1);
    } else {
      date.setMonth(date.getMonth() + 12);
    }
    return date;
  }

  private normalizeMpStatus(raw: string): PamMpStatus | null {
    const allowed: PamMpStatus[] = [
      'pending',
      'in_process',
      'approved',
      'authorized',
      'rejected',
      'cancelled',
      'refunded',
      'charged_back',
    ];
    return allowed.includes(raw as PamMpStatus) ? (raw as PamMpStatus) : null;
  }

  private async ensureSettings() {
    return this.prisma.pamWidgetSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', benefits: [], notes: [] },
      update: {},
    });
  }

  private async ensureMuseoPopup() {
    return this.prisma.museoPopupSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...DEFAULT_MUSEO_POPUP },
      update: {},
    });
  }

  private async findPlan(id: string) {
    const row = await this.prisma.pamPlan.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Plan no encontrado');
    return row;
  }

  private async findRegistration(id: string) {
    const row = await this.prisma.pamRegistration.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Registro no encontrado');
    return row;
  }
}

export { MP_CONFIRMED, PamEmailStatus };
