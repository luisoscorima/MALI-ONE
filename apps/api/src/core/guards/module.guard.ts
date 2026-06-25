import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule, User } from '@prisma/client';
import { userHasModule } from '../permissions/user-modules';
import { MODULES_KEY } from './module.decorator';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModules = this.reflector.getAllAndOverride<AppModule[]>(
      MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredModules?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as User | undefined;
    if (!user) {
      throw new ForbiddenException('No tienes acceso a este módulo');
    }

    const allowed = requiredModules.some((module) =>
      userHasModule(user, module),
    );
    if (!allowed) {
      throw new ForbiddenException('No tienes acceso a este módulo');
    }

    return true;
  }
}
