import { IsEmail, Matches, MaxLength } from 'class-validator';

export class SaveEmailSenderDto {
  @IsEmail()
  @MaxLength(320)
  @Matches(/^[^@\s]+@mali\.pe$/i, {
    message: 'El remitente debe ser un correo @mali.pe',
  })
  email!: string;
}
