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
  ValidateIf,
} from 'class-validator';
import {
  MALICHIMP_AUDIENCE_MODE,
  MALICHIMP_RESOLVE_EMAILS_MAX,
  type MalichimpAudienceMode,
} from '@mali-one/shared';

const AUDIENCE_MODES = Object.values(MALICHIMP_AUDIENCE_MODE);

function audienceModeOf(dto: {
  audienceMode?: string | null;
}): MalichimpAudienceMode {
  if (dto.audienceMode === MALICHIMP_AUDIENCE_MODE.tags) return 'tags';
  if (dto.audienceMode === MALICHIMP_AUDIENCE_MODE.emails) return 'emails';
  return 'groups';
}

export class MalichimpAudienceDto {
  @IsOptional()
  @IsIn(AUDIENCE_MODES)
  audienceMode?: MalichimpAudienceMode;

  @ValidateIf((dto: MalichimpAudienceDto) => audienceModeOf(dto) === 'groups')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  groupOptionIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  excludeGroupOptionIds?: string[];

  @ValidateIf((dto: MalichimpAudienceDto) => audienceModeOf(dto) === 'tags')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  excludeTagIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50_000)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  excludeContactIds?: string[];

  /** Required (≥1) for emails mode (enforced in service); optional allowlist for groups/tags. */
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

  /** Token returned when reviewing working-copy content; mismatch → 409. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contentRevision?: string;
}

export class ResolveMalichimpEmailsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MALICHIMP_RESOLVE_EMAILS_MAX)
  @IsString({ each: true })
  @MaxLength(320, { each: true })
  emails!: string[];
}

const MALICHIMP_CONTENT_BRANDS = [
  'museo',
  'cursos_arte',
  'extension_profesional',
] as const;

export class CreateMalichimpContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  subject!: string;

  @IsString()
  @MinLength(1)
  htmlBody!: string;

  @IsOptional()
  @IsString()
  designJson?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn([...MALICHIMP_CONTENT_BRANDS])
  brand?: (typeof MALICHIMP_CONTENT_BRANDS)[number] | null;
}

export class UpdateMalichimpWorkingCopyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  htmlBody?: string;

  @IsOptional()
  @IsString()
  designJson?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn([...MALICHIMP_CONTENT_BRANDS])
  brand?: (typeof MALICHIMP_CONTENT_BRANDS)[number] | null;

  /** Token from GET content; mismatch → 409. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contentRevision?: string;
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
  @MaxLength(64)
  contentRevision?: string;

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
