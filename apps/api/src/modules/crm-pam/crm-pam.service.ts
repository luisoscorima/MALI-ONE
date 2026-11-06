import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WhatsappCrmClientService } from '../crm/whatsapp-crm-client.service';

@Injectable()
export class CrmPamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crm: WhatsappCrmClientService,
  ) {}

  async listContacts(query: {
    q?: string;
    segment?: string;
    attr_key?: string;
    attr_value?: string;
    has_email?: boolean;
    page?: number;
    limit?: number;
  }) {
    if (!this.crm.configured) {
      throw new BadRequestException(
        'WhatsApp CRM no configurado (WHATSAPP_CRM_BASE_URL / TOKEN)',
      );
    }
    return this.crm.fetchContacts({
      area: 'pam',
      q: query.q,
      segment: query.segment,
      attr_key: query.attr_key,
      attr_value: query.attr_value,
      has_email: query.has_email,
      page: query.page ?? 1,
      limit: query.limit ?? 100,
    });
  }

  listAttributeDefinitions() {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.fetchAttributeDefinitions('pam');
  }

  listSegments() {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.fetchSegments('pam');
  }

  createAttributeDefinition(dto: {
    scope: 'area' | 'segment';
    segment_slug?: string;
    slug: string;
    label: string;
    field_type?: string;
    sort_order?: number;
    required?: boolean;
  }) {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.createAttributeDefinition({ area: 'pam', ...dto });
  }

  updateAttributeDefinition(
    id: number,
    dto: {
      label: string;
      field_type?: string;
      sort_order?: number;
      required?: boolean;
      active?: boolean;
    },
  ) {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.updateAttributeDefinition(id, dto, 'pam');
  }

  patchContact(
    contactId: number,
    dto: {
      name?: string;
      last_name?: string;
      email?: string | null;
      dni?: string | null;
      opt_in?: boolean;
      opt_in_email?: boolean;
      segment_slugs?: string[];
      attributes?: Record<string, string>;
    },
  ) {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.patchContact(contactId, dto, 'pam');
  }

  listPayments() {
    return this.prisma.pamRegistration.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async ensureDefaultPaymentMethod() {
    await this.prisma.pamPaymentMethod.upsert({
      where: { slug: 'mercado_pago' },
      create: {
        slug: 'mercado_pago',
        label: 'Mercado Pago',
        active: true,
        system: true,
        sortOrder: 0,
      },
      update: { system: true },
    });
  }

  async listPaymentMethods(includeInactive = true) {
    await this.ensureDefaultPaymentMethod();
    return this.prisma.pamPaymentMethod.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  private slugifyPaymentMethod(label: string, explicit?: string) {
    const base = String(explicit ?? label)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
    if (!base) {
      throw new BadRequestException('Slug de medio de pago inválido');
    }
    return base;
  }

  async createPaymentMethod(dto: {
    label: string;
    slug?: string;
    active?: boolean;
    sortOrder?: number;
  }) {
    const label = dto.label.trim();
    if (!label) throw new BadRequestException('Nombre requerido');
    const slug = this.slugifyPaymentMethod(label, dto.slug);
    if (slug === 'mercado_pago') {
      throw new BadRequestException(
        'Mercado Pago ya existe como medio de pago del sistema',
      );
    }
    try {
      return await this.prisma.pamPaymentMethod.create({
        data: {
          slug,
          label,
          active: dto.active ?? true,
          system: false,
          sortOrder: dto.sortOrder ?? 100,
        },
      });
    } catch {
      throw new BadRequestException(`Ya existe un medio de pago con slug "${slug}"`);
    }
  }

  async updatePaymentMethod(
    id: string,
    dto: { label?: string; active?: boolean; sortOrder?: number },
  ) {
    const existing = await this.prisma.pamPaymentMethod.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Medio de pago no encontrado');
    if (existing.system && dto.active === false) {
      throw new BadRequestException(
        'No se puede desactivar Mercado Pago (medio de sistema)',
      );
    }
    return this.prisma.pamPaymentMethod.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deletePaymentMethod(id: string) {
    const existing = await this.prisma.pamPaymentMethod.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Medio de pago no encontrado');
    if (existing.system) {
      throw new BadRequestException(
        'No se puede eliminar Mercado Pago (medio de sistema)',
      );
    }
    const inUse = await this.prisma.pamRegistration.count({
      where: { paymentMethod: existing.slug },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        `Hay ${inUse} pago(s) con este medio. Desactívalo en lugar de eliminarlo.`,
      );
    }
    await this.prisma.pamPaymentMethod.delete({ where: { id } });
    return { ok: true };
  }

  async resolvePaymentMethodSlug(slug?: string) {
    await this.ensureDefaultPaymentMethod();
    const value = String(slug ?? 'mercado_pago').trim() || 'mercado_pago';
    const method = await this.prisma.pamPaymentMethod.findUnique({
      where: { slug: value },
    });
    if (!method || !method.active) {
      throw new BadRequestException(
        `Medio de pago inválido o inactivo: "${value}"`,
      );
    }
    return method.slug;
  }

  async createPayment(dto: {
    nombres: string;
    apellidos: string;
    dni: string;
    celular: string;
    correo: string;
    direccion?: string;
    ciudad?: string;
    distrito?: string;
    genero?: string;
    fechaNacimiento?: string;
    comoTeEnteraste?: string;
    plan: string;
    frecuencia: string;
    paymentMethod?: string;
    checkoutUrl?: string;
    mpStatus?: string;
    expiryDate?: string;
    aceptaPrivacidad?: boolean;
  }) {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }

    const paymentMethod = await this.resolvePaymentMethodSlug(dto.paymentMethod);

    const created = await this.prisma.pamRegistration.create({
      data: {
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos.trim(),
        dni: dto.dni.trim(),
        celular: dto.celular.trim(),
        correo: dto.correo.trim().toLowerCase(),
        direccion: dto.direccion?.trim() || null,
        ciudad: dto.ciudad?.trim() || null,
        distrito: dto.distrito?.trim() || null,
        genero: dto.genero?.trim() || null,
        fechaNacimiento: dto.fechaNacimiento?.trim() || null,
        comoTeEnteraste: dto.comoTeEnteraste?.trim() || null,
        plan: dto.plan.trim(),
        frecuencia: dto.frecuencia.trim(),
        paymentMethod,
        checkoutUrl: dto.checkoutUrl?.trim() || null,
        aceptaPrivacidad: dto.aceptaPrivacidad ?? true,
        mpStatus: dto.mpStatus
          ? (dto.mpStatus as import('@prisma/client').PamMpStatus)
          : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });

    await this.crm.syncPamRegistrationAsync(created);
    return created;
  }

  /** Vincula un pago concreto al contacto WA (payment_id = este registro). */
  async linkPayment(paymentId: string) {
    const reg = await this.prisma.pamRegistration.findUnique({
      where: { id: paymentId },
    });
    if (!reg) throw new NotFoundException('Pago no encontrado');
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    await this.crm.syncPamRegistrationAsync(reg);
    return { ok: true, paymentId: reg.id, phone: reg.celular };
  }

  /**
   * Por cada teléfono con pagos, vincula el PamRegistration más reciente
   * (createdAt) al contacto WhatsApp vía payment_id.
   */
  async linkPaymentsByPhone() {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    const regs = await this.prisma.pamRegistration.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const latestByPhone = new Map<string, (typeof regs)[number]>();
    for (const reg of regs) {
      const phone = this.crm.toE164Pe(reg.celular);
      if (!phone) continue;
      if (!latestByPhone.has(phone)) {
        latestByPhone.set(phone, reg);
      }
    }

    let linked = 0;
    const errors: Array<{ paymentId: string; error: string }> = [];
    for (const reg of latestByPhone.values()) {
      try {
        await this.crm.syncPamRegistrationAsync(reg);
        linked += 1;
      } catch (err) {
        errors.push({
          paymentId: reg.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      ok: true,
      linked,
      phones: latestByPhone.size,
      errors,
    };
  }

}
