import { IsOptional, IsString, IsUrl } from 'class-validator';

export class ShortenUrlDto {
  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @IsString()
  customSlug?: string;
}
