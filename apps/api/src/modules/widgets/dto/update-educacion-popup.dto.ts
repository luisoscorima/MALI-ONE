import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateEducacionPopupDto {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @IsOptional()
  @IsString()
  imagenLinkUrl?: string | null;

  @IsOptional()
  @IsString()
  imagenTarget?: string;

  @IsOptional()
  @IsString()
  titulo?: string | null;

  @IsOptional()
  @IsString()
  botonTexto?: string;

  @IsOptional()
  @IsString()
  botonUrl?: string;

  @IsOptional()
  @IsString()
  botonTarget?: string;

  @IsOptional()
  @IsBoolean()
  showOnce?: boolean;

  @IsOptional()
  @IsBoolean()
  scheduleEnabled?: boolean;

  @IsOptional()
  @IsString()
  scheduleDateStart?: string | null;

  @IsOptional()
  @IsString()
  scheduleDateEnd?: string | null;

  @IsOptional()
  @IsString()
  scheduleTimeStart?: string | null;

  @IsOptional()
  @IsString()
  scheduleTimeEnd?: string | null;

  @IsOptional()
  @IsString()
  scheduleTimezone?: string;
}
