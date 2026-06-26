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
  imageCorreo?: string;

  @IsOptional()
  @IsString()
  mapsApiKey?: string;
}
