import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import { existsSync, readFileSync, statSync } from 'fs';
import { google, admin_directory_v1 } from 'googleapis';
import { PrismaService } from '../../core/prisma/prisma.service';

interface GoogleApiErrorBody {
  error?: { message?: string; status?: string };
}

@Injectable()
export class GoogleAdminService {
  private readonly logger = new Logger(GoogleAdminService.name);
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

    if (!existsSync(jsonPath)) {
      throw new ServiceUnavailableException(
        `No se encontró la service account en ${jsonPath}. Coloca el JSON en secrets/ y define GOOGLE_SERVICE_ACCOUNT_JSON_PATH (ej. /run/secrets/google-sa.json).`,
      );
    }

    if (!statSync(jsonPath).isFile()) {
      throw new ServiceUnavailableException(
        `${jsonPath} es un directorio, no un archivo JSON. Si Docker creó esa carpeta, ejecuta: docker compose down api && cp secrets/TU-ARCHIVO.json secrets/google-sa.json && docker compose up -d api`,
      );
    }

    let credentials: { client_email?: string; private_key?: string };
    try {
      credentials = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EISDIR') {
        throw new ServiceUnavailableException(
          `${jsonPath} es un directorio dentro del contenedor. Recrea el servicio api tras copiar el JSON real a secrets/google-sa.json en el host.`,
        );
      }
      throw new ServiceUnavailableException(
        `El archivo ${jsonPath} no es un JSON válido de service account.`,
      );
    }

    if (!credentials.client_email || !credentials.private_key) {
      throw new ServiceUnavailableException(
        'El JSON de service account no contiene client_email o private_key.',
      );
    }

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

  private async run<T>(action: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(`Google Admin SDK (${action})`, this.formatError(error));
      throw this.toHttpException(error);
    }
  }

  private formatError(error: unknown): string {
    if (this.isGoogleApiError(error)) {
      const googleError = error.response?.data as GoogleApiErrorBody | undefined;
      return (
        googleError?.error?.message ??
        error.message ??
        'Error desconocido de Google API'
      );
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Error desconocido';
  }

  private isGoogleApiError(
    error: unknown,
  ): error is { message: string; response?: { data?: unknown } } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    );
  }

  private toHttpException(error: unknown): ServiceUnavailableException {
    if (error instanceof ServiceUnavailableException) {
      return error;
    }

    const detail = this.formatError(error);
    return new ServiceUnavailableException(`Google Admin SDK: ${detail}`);
  }

  async healthCheck() {
    try {
      await this.run('healthCheck', async () => {
        const admin = this.getDirectory();
        await admin.users.list({ customer: 'my_customer', maxResults: 1 });
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof ServiceUnavailableException
            ? error.message
            : this.formatError(error),
      };
    }
  }

  async listUsers(query?: string, pageToken?: string) {
    return this.run('listUsers', async () => {
      const admin = this.getDirectory();
      const response = await admin.users.list({
        customer: 'my_customer',
        maxResults: 50,
        pageToken,
        query: query || undefined,
        orderBy: 'email',
      });

      return {
        users: (response.data.users ?? []).map(
          (u: admin_directory_v1.Schema$User) => this.mapUser(u),
        ),
        nextPageToken: response.data.nextPageToken ?? null,
      };
    });
  }

  async getUser(email: string) {
    return this.run('getUser', async () => {
      const admin = this.getDirectory();
      const response = await admin.users.get({ userKey: email });
      return this.mapUser(response.data);
    });
  }

  async createUser(data: {
    primaryEmail: string;
    givenName: string;
    familyName: string;
    password: string;
    orgUnitPath?: string;
  }) {
    return this.run('createUser', async () => {
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
    });
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
    return this.run('updateUser', async () => {
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
    });
  }

  async resetPassword(email: string) {
    return this.run('resetPassword', async () => {
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
    });
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
