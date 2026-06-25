import type { AppModule, AuthUser } from '@mali-one/shared';

export function hasModule(
  user: AuthUser | null | undefined,
  module: AppModule,
): boolean {
  return !!user?.modules.includes(module);
}
