import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppModule, User, UserRole } from '@prisma/client';
import { AppUserDto } from '@mali-one/shared';
import { resolveUserModules } from '../../core/permissions/user-modules';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class AppUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AppUserDto[]> {
    const users = await this.prisma.user.findMany({
      include: { moduleAccess: true },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });
    return users.map((user) => this.toDto(user));
  }

  async updateModules(
    actor: User,
    userId: string,
    modules: AppModule[],
  ): Promise<AppUserDto> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { moduleAccess: true },
    });
    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (target.role === UserRole.admin) {
      throw new BadRequestException(
        'No se pueden modificar los módulos del administrador del sistema',
      );
    }

    const uniqueModules = [...new Set(modules)];

    await this.prisma.$transaction([
      this.prisma.userModuleAccess.deleteMany({ where: { userId } }),
      ...(uniqueModules.length
        ? [
            this.prisma.userModuleAccess.createMany({
              data: uniqueModules.map((module) => ({ userId, module })),
            }),
          ]
        : []),
    ]);

    await this.prisma.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'UPDATE_USER_MODULES',
        targetEmail: target.email,
        payload: { modules: uniqueModules },
      },
    });

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { moduleAccess: true },
    });
    return this.toDto(updated);
  }

  private toDto(
    user: User & { moduleAccess: { module: AppModule }[] },
  ): AppUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      modules: resolveUserModules(user),
      createdAt: user.createdAt.toISOString(),
    };
  }
}
