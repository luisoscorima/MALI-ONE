import { NewsletterScope } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, Matches, MaxLength } from 'class-validator';

export class SaveEmailSenderDto {
  @IsEmail()
  @MaxLength(320)
  @Matches(/^[^@\s]+@mali\.pe$/i, {
    message: 'El remitente debe ser un correo @mali.pe',
  })
  email!: string;

  /** Required for hub create; module routes force their own scope. */
  @IsOptional()
  @IsEnum(NewsletterScope)
  scope?: NewsletterScope;
}

export class ListEmailSendersQueryDto {
  @IsOptional()
  @IsEnum(NewsletterScope)
  scope?: NewsletterScope;
}
