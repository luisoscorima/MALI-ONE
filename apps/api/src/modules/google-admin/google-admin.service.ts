import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { google, admin_directory_v1 } from 'googleapis';
import { readFileSync } from 'fs';
import { PrismaService } from '../../core/prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class GoogleAdminService {
  private directory: admin_directory_v1.Admin | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getDirectory(): admin_directory_v1.Admin {
    if (this.directory) {
      return this.directory;
    }

    const jsonPath = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON_PATH');
    const impersonate = this.config.get<string>('GOOGLE_ADMIN_IMPERSONATE');

    if (!jsonPath || !impersonate) {
      throw new ServiceUnavailableException(
        'Google Admin SDK no configurado. Revisa GOOGLE_SERVICE_ACCOUNT_JSON_PATH y GOOGLE_ADMIN_IMPERSONATE.',
      );
    }

    const credentials = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.user.security',
      ],
      subject: impersonate,
    });

    this.directory = google.admin({ version: 'directory_v1', auth });
    return this.directory;
  }

  async healthCheck() {
    try {
      const admin = this.getDirectory();
      await admin.users.list({ customer: 'my_customer', maxResults: 1 });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listUsers(query?: string, pageToken?: string) {
    const admin = this.getDirectory();
    const response = await admin.users.list({
      customer: 'my_customer',
      maxResults: 50,
      pageToken,
      query: query || undefined,
      orderBy: 'email',
    });

    return {
      users: (response.data.users ?? []).map((u: admin_directory_v1.Schema$User) =>
        this.mapUser(u),
      ),
      nextPageToken: response.data.nextPageToken ?? null,
    };
  }

  async getUser(email: string) {
    const admin = this.getDirectory();
    const response = await admin.users.get({ userKey: email });
    return this.mapUser(response.data);
  }

  async createUser(data: {
    primaryEmail: string;
    givenName: string;
    familyName: string;
    password: string;
    orgUnitPath?: string;
  }) {
    const admin = this.getDirectory();
    const response = await admin.users.insert({
      requestBody: {
        primaryEmail: data.primaryEmail,
        name: {
          givenName: data.givenName,
          familyName: data.familyName,
        },
        password: data.password,
        changePasswordAtNextLogin: true,
        orgUnitPath: data.orgUnitPath ?? '/',
      },
    });
    return this.mapUser(response.data);
  }

  async updateUser(
    email: string,
    data: {
      givenName?: string;
      familyName?: string;
      suspended?: boolean;
      orgUnitPath?: string;
    },
  ) {
    const admin = this.getDirectory();
    const requestBody: Record<string, unknown> = {};

    if (data.givenName || data.familyName) {
      requestBody.name = {
        ...(data.givenName ? { givenName: data.givenName } : {}),
        ...(data.familyName ? { familyName: data.familyName } : {}),
      };
    }
    if (data.suspended !== undefined) {
      requestBody.suspended = data.suspended;
    }
    if (data.orgUnitPath) {
      requestBody.orgUnitPath = data.orgUnitPath;
    }

    const response = await admin.users.update({
      userKey: email,
      requestBody,
    });
    return this.mapUser(response.data);
  }

  async resetPassword(email: string) {
    const admin = this.getDirectory();
    const tempPassword = this.generateTempPassword();
    await admin.users.update({
      userKey: email,
      requestBody: {
        password: tempPassword,
        changePasswordAtNextLogin: true,
      },
    });
    return { temporaryPassword: tempPassword };
  }

  async suspendUser(email: string) {
    return this.updateUser(email, { suspended: true });
  }

  async logAction(
    actor: User,
    action: string,
    targetEmail: string | null,
    payload?: Prisma.InputJsonValue,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action,
        targetEmail,
        payload: payload ?? undefined,
      },
    });
  }

  private generateTempPassword(): string {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private mapUser(u: admin_directory_v1.Schema$User) {
    return {
      id: u.id ?? '',
      primaryEmail: u.primaryEmail ?? '',
      name: {
        givenName: u.name?.givenName ?? '',
        familyName: u.name?.familyName ?? '',
        fullName: u.name?.fullName ?? undefined,
      },
      suspended: u.suspended ?? false,
      orgUnitPath: u.orgUnitPath ?? '/',
      creationTime: u.creationTime ?? undefined,
      lastLoginTime: u.lastLoginTime ?? undefined,
    };
  }
}
