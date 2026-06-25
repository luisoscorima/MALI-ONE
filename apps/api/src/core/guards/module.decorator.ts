import { SetMetadata } from '@nestjs/common';
import { AppModule } from '@prisma/client';

export const MODULES_KEY = 'modules';
export const RequireModule = (...modules: AppModule[]) =>
  SetMetadata(MODULES_KEY, modules);
