import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { Public } from '../../core/guards/public.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return;
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    if (!user) {
      throw new UnauthorizedException();
    }

    const token = this.authService.signToken(user);
    const cookieDomain = this.config.get<string>('COOKIE_DOMAIN');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    res.cookie('mali_one_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      domain: cookieDomain || undefined,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    const appUrl = this.config.getOrThrow<string>('APP_URL').replace(/\/$/, '');
    res.redirect(`${appUrl}/`);
  }

  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as User;
    return this.authService.toAuthUser(user);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    const cookieDomain = this.config.get<string>('COOKIE_DOMAIN');
    res.clearCookie('mali_one_token', {
      httpOnly: true,
      path: '/',
      domain: cookieDomain || undefined,
    });
    return { ok: true };
  }
}
