import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { ScreenCastMediaType } from '@prisma/client';

export class CreateScreenCastPlaylistDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateScreenCastPlaylistDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CreateScreenCastPlaylistItemDto {
  @IsString()
  @MinLength(1)
  mediaUrl!: string;

  @IsEnum(ScreenCastMediaType)
  mediaType!: ScreenCastMediaType;

  @IsOptional()
  @IsInt()
  @Min(1000)
  durationMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateScreenCastPlaylistItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  mediaUrl?: string;

  @IsOptional()
  @IsEnum(ScreenCastMediaType)
  mediaType?: ScreenCastMediaType;

  @IsOptional()
  @IsInt()
  @Min(1000)
  durationMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CreateScreenCastMonitorDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,62}$/, {
    message:
      'screenKey debe ser minúsculas, números, guiones o guion bajo (2–63 chars)',
  })
  screenKey!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  playlistId?: string | null;
}

export class UpdateScreenCastMonitorDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,62}$/, {
    message:
      'screenKey debe ser minúsculas, números, guiones o guion bajo (2–63 chars)',
  })
  screenKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsString()
  playlistId?: string | null;
}
