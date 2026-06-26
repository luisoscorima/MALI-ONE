import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEducacionDistrictDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateEducacionDistrictDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
