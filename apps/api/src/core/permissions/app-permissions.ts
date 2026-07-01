import { APP_PERMISSION_MODULES, AppPermission } from '@mali-one/shared';
import { AppModule, User, UserRole } from '@prisma/client';
import { userHasModule } from './user-modules';

type UserWithModules = User & {
  moduleAccess?: { module: AppModule }[];
  modules?: AppModule[];
};

export function permissionModule(permission: AppPermission): AppModule {
  return APP_PERMISSION_MODULES[permission] as AppModule;
}

export function userHasPermission(
  user: UserWithModules | null | undefined,
  permission: AppPermission,
): boolean {
  if (!user) return false;
  return userHasModule(user, permissionModule(permission));
}
