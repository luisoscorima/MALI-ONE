import { IsString, MinLength } from 'class-validator';

export class MkdirDto {
  @IsString()
  @MinLength(1)
  path!: string;
}

export class RenameFileDto {
  @IsString()
  @MinLength(1)
  from!: string;

  @IsString()
  @MinLength(1)
  to!: string;
}

export class CopyFileDto {
  @IsString()
  @MinLength(1)
  from!: string;

  @IsString()
  @MinLength(1)
  to!: string;
}

export class RestoreFileDto {
  @IsString()
  @MinLength(1)
  path!: string;
}
