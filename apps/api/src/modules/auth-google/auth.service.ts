import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateGoogleProfile(profile: {
    id: string;
    emails?: { value: string }[];
    displayName?: string;
    photos?: { value: string }[];
    _json?: { hd?: string };
  }): Promise<User> {
    const email = profile.emails?.[0]?.value;
    const hd = profile._json?.hd;
    const allowedDomain = this.config.getOrThrow<string>('ALLOWED_DOMAIN');

    if (!email?.endsWith(`@${allowedDomain}`) || hd !== allowedDomain) {
      throw new ForbiddenException(`Solo cuentas @${allowedDomain}`);
    }

    const bootstrapAdmin = this.config.get<string>('BOOTSTRAP_ADMIN_EMAIL');
    const shouldBeAdmin = bootstrapAdmin && email === bootstrapAdmin;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return this.prisma.user.update({
        where: { email },
        data: {
          googleId: profile.id,
          name: profile.displayName ?? email,
          picture: profile.photos?.[0]?.value ?? null,
          ...(shouldBeAdmin ? { role: 'admin' as UserRole } : {}),
        },
      });
    }

    const role: UserRole = shouldBeAdmin ? 'admin' : 'operator';

    return this.prisma.user.create({
      data: {
        googleId: profile.id,
        email,
        name: profile.displayName ?? email,
        picture: profile.photos?.[0]?.value ?? null,
        role,
      },
    });
  }

  signToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.sign(payload);
  }

  toAuthUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toAuthUser(user);
  }
}
