import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { User } from '@prisma/client';
import { SUPER_ADMIN_KEY } from './super-admin.decorator';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as User | undefined;
    const bootstrap = this.config.get<string>('BOOTSTRAP_ADMIN_EMAIL');

    if (!user || !bootstrap || user.email !== bootstrap) {
      throw new ForbiddenException(
        'Solo el super administrador puede acceder a este módulo',
      );
    }

    return true;
  }
}
