import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class MalichimpAudienceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  groupOptionIds!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  excludeGroupOptionIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50_000)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  excludeContactIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50_000)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  includeContactIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  /** Preview-only search by name/email. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;
}

export class CreateMalichimpCampaignDto extends MalichimpAudienceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(1)
  newsletterId!: string;

  /** Allows confirming a campaign with a draft newsletter created from MALICHIMP. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  draftNewsletterId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Matches(/^[^\r\n]+$/)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/^[^\r\n]+$/)
  fromName!: string;

  @IsEmail()
  @MaxLength(320)
  @Matches(/^[^@\s]+@mali\.pe$/i, {
    message: 'El remitente debe ser un correo @mali.pe',
  })
  fromEmail!: string;

  @IsEmail()
  @MaxLength(320)
  @Matches(/^[^@\s]+@mali\.pe$/i, {
    message: 'La respuesta debe ser un correo @mali.pe',
  })
  replyTo!: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class CreateMalichimpNewsletterDraftDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  title!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  subject?: string;
}
