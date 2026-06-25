import { AppModule } from '@prisma/client';
import { IsArray, IsEnum } from 'class-validator';

export class UpdateUserModulesDto {
  @IsArray()
  @IsEnum(AppModule, { each: true })
  modules!: AppModule[];
}
