import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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
