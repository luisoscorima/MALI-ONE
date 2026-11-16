import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
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
}

export class CreateMalichimpCampaignDto extends MalichimpAudienceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(1)
  newsletterId!: string;

  @IsEmail()
  @MaxLength(320)
  replyTo!: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
