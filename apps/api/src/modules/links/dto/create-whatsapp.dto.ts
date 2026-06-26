import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWhatsappLinkDto {
  @IsString()
  @MinLength(8)
  phone!: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  customSlug?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
