import { SetMetadata } from '@nestjs/common';
import { AppPermission } from '@mali-one/shared';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
