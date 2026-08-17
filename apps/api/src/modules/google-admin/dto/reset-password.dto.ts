import { IsBoolean, IsOptional } from 'class-validator';

export class ResetPasswordDto {
  @IsOptional()
  @IsBoolean()
  forceChangePassword?: boolean;

  @IsOptional()
  @IsBoolean()
  signOutAfterReset?: boolean;
}
