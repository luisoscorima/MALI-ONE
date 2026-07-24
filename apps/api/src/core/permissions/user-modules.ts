import { AppModule, User, UserRole } from '@prisma/client';

export const ALL_APP_MODULES: AppModule[] = [
  AppModule.links,
  AppModule.workspace_users,
  AppModule.s3_manager,
  AppModule.password_vault,
  AppModule.widget_educacion,
  AppModule.widget_biblioteca,
  AppModule.widget_museo,
  AppModule.widget_pam,
  AppModule.screen_cast,
  AppModule.bsale_reports,
  AppModule.newsletters,
  AppModule.crm_pam,
];

type UserWithModules = User & {
  moduleAccess?: { module: AppModule }[];
};

export function resolveUserModules(user: UserWithModules): AppModule[] {
  if (user.role === UserRole.admin) {
    return ALL_APP_MODULES;
  }
  return user.moduleAccess?.map((entry) => entry.module) ?? [];
}

export function userHasModule(
  user: UserWithModules,
  module: AppModule,
): boolean {
  return resolveUserModules(user).includes(module);
}
