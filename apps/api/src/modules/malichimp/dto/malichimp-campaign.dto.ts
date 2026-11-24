import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
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

export class ExportMalichimpCampaignsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  campaignIds?: string[];
}

export const MALICHIMP_CAMPAIGN_SEND_EVENTS = [
  'all',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'suppressed',
  'failed',
  'pending',
  'replied',
] as const;

export type MalichimpCampaignSendEvent =
  (typeof MALICHIMP_CAMPAIGN_SEND_EVENTS)[number];

export const MALICHIMP_SEND_SCOPES = ['production', 'test', 'all'] as const;
export type MalichimpSendScope = (typeof MALICHIMP_SEND_SCOPES)[number];

export class MalichimpCampaignSendsQueryDto {
  @IsOptional()
  @IsIn(MALICHIMP_CAMPAIGN_SEND_EVENTS)
  event?: MalichimpCampaignSendEvent;

  @IsOptional()
  @IsIn(MALICHIMP_SEND_SCOPES)
  scope?: MalichimpSendScope;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

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
}

export class MalichimpCampaignStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @IsOptional()
  @IsIn(MALICHIMP_SEND_SCOPES)
  scope?: MalichimpSendScope;
}

export class SendMalichimpTestDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  campaignId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(1)
  newsletterId!: string;

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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsEmail({}, { each: true })
  @MaxLength(320, { each: true })
  emails!: string[];
}

export class UpdateMalichimpContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  institutionName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  jobTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  classification?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  groupOptionIds?: string[];
}
