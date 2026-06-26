import { IsOptional, IsString } from 'class-validator';

export class UpdateEducacionSettingsDto {
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  emailVirtual?: string;

  @IsOptional()
  @IsString()
  soporteVirtual?: string;

  @IsOptional()
  @IsString()
  imageRectangulo?: string;

  @IsOptional()
  @IsString()
  imageWhatsapp?: string;

  @IsOptional()
  @IsString()
  imageCirculo?: string;

  @IsOptional()
  @IsString()
  imageCorreo?: string;

  @IsOptional()
  @IsString()
  imageMarker?: string;

  @IsOptional()
  @IsString()
  mapsApiKey?: string;

  @IsOptional()
  @IsString()
  googleCalendarId?: string;
}
