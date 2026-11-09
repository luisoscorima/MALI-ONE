import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInternalCampaignDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  newsletterId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsEmail({}, { each: true })
  recipients!: string[];
}
