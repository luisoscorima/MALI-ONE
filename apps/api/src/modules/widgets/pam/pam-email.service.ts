import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PamEmailStatus, PamMpStatus, PamRegistration } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { MP_CONFIRMED } from './pam-widgets.service';

const DIAS_ANTES_AVISO = 5;

@Injectable()
export class PamEmailService {
  private readonly logger = new Logger(PamEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getTransport() {
    const host = this.config.get<string>('PAM_SMTP_HOST');
    const user = this.config.get<string>('PAM_SMTP_USER');
    const pass = this.config.get<string>('PAM_SMTP_PASS');
    if (!host || !user || !pass) return null;

    return nodemailer.createTransport({
      host,
      port: Number(this.config.get('PAM_SMTP_PORT') ?? 587),
      secure: this.config.get('PAM_SMTP_SECURE') === 'true',
      auth: { user, pass },
    });
  }

  async sendWelcomeIfNeeded(registrationId: string) {
    const reg = await this.prisma.pamRegistration.findUnique({
      where: { id: registrationId },
    });
    if (!reg || reg.welcomeEmail !== PamEmailStatus.PENDIENTE) return;
    if (!reg.mpStatus || !MP_CONFIRMED.includes(reg.mpStatus)) return;
    await this.sendWelcome(reg);
  }

  async sendPendingWelcomeEmails() {
    const rows = await this.prisma.pamRegistration.findMany({
      where: {
        welcomeEmail: PamEmailStatus.PENDIENTE,
        mpStatus: { in: MP_CONFIRMED as PamMpStatus[] },
      },
      take: 50,
    });
    for (const reg of rows) {
      await this.sendWelcome(reg);
    }
  }

  async sendPendingExpiryNotices() {
    const now = new Date();
    const limit = new Date(now);
    limit.setDate(limit.getDate() + DIAS_ANTES_AVISO);

    const rows = await this.prisma.pamRegistration.findMany({
      where: {
        expiryNotice: PamEmailStatus.PENDIENTE,
        mpStatus: { in: MP_CONFIRMED as PamMpStatus[] },
        expiryDate: { lte: limit, gte: now },
      },
      take: 50,
    });

    for (const reg of rows) {
      await this.sendExpiryNotice(reg);
    }
  }

  private async sendWelcome(reg: PamRegistration) {
    if (!this.isValidEmail(reg.correo)) {
      await this.setWelcomeStatus(reg.id, PamEmailStatus.ERROR_DATOS);
      return;
    }

    const transport = this.getTransport();
    if (!transport) {
      this.logger.warn('PAM SMTP no configurado; omitiendo correo de bienvenida');
      return;
    }

    const from =
      this.config.get('PAM_SMTP_FROM') ?? 'pam@mali.pe';

    try {
      await transport.sendMail({
        from,
        to: reg.correo,
        subject: 'Bienvenido al Programa Amigos del MALI',
        html: `<p>Hola ${reg.nombres},</p>
<p>Gracias por unirte al Programa Amigos del MALI (plan ${reg.plan}).</p>
<p>Tu membresía está activa. Te esperamos en el museo.</p>
<p>Equipo PAM — Museo de Arte de Lima</p>`,
      });
      await this.setWelcomeStatus(reg.id, PamEmailStatus.ENVIADO);
    } catch (err) {
      this.logger.error('Error enviando bienvenida PAM', err);
      await this.setWelcomeStatus(reg.id, PamEmailStatus.ERROR_TEMP);
    }
  }

  private async sendExpiryNotice(reg: PamRegistration) {
    if (!reg.expiryDate || !this.isValidEmail(reg.correo)) {
      await this.setExpiryStatus(reg.id, PamEmailStatus.ERROR_DATOS);
      return;
    }

    const transport = this.getTransport();
    if (!transport) {
      this.logger.warn('PAM SMTP no configurado; omitiendo aviso de caducidad');
      return;
    }

    const from =
      this.config.get('PAM_SMTP_FROM') ?? 'pam@mali.pe';
    const fecha = reg.expiryDate.toLocaleDateString('es-PE');

    try {
      await transport.sendMail({
        from,
        to: reg.correo,
        subject: 'Tu membresía PAM está por vencer',
        html: `<p>Hola ${reg.nombres},</p>
<p>Te recordamos que tu membresía del Programa Amigos del MALI vence el ${fecha}.</p>
<p>Renueva para seguir disfrutando de tus beneficios.</p>
<p>Equipo PAM — Museo de Arte de Lima</p>`,
      });
      await this.setExpiryStatus(reg.id, PamEmailStatus.ENVIADO);
    } catch (err) {
      this.logger.error('Error enviando aviso caducidad PAM', err);
      await this.setExpiryStatus(reg.id, PamEmailStatus.ERROR_TEMP);
    }
  }

  private isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  private setWelcomeStatus(id: string, status: PamEmailStatus) {
    return this.prisma.pamRegistration.update({
      where: { id },
      data: { welcomeEmail: status },
    });
  }

  private setExpiryStatus(id: string, status: PamEmailStatus) {
    return this.prisma.pamRegistration.update({
      where: { id },
      data: { expiryNotice: status },
    });
  }
}
