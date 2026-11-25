import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { resolveUserModules } from '../../core/permissions/user-modules';
import { PrismaService } from '../../core/prisma/prisma.service';

/** No escribir lastSeenAt en cada request autenticado. */
const LAST_SEEN_THROTTLE_MS = 60_000;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['mali_one_token'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { moduleAccess: true },
    });
    if (!user) {
      return null;
    }

    const now = Date.now();
    const lastSeenMs = user.lastSeenAt?.getTime() ?? 0;
    if (now - lastSeenMs >= LAST_SEEN_THROTTLE_MS) {
      void this.prisma.user
        .update({
          where: { id: user.id },
          data: { lastSeenAt: new Date(now) },
        })
        .catch(() => undefined);
    }

    return {
      ...user,
      modules: resolveUserModules(user),
    };
  }
}
