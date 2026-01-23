import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmailAccountDto {
    @ApiProperty({
        description: 'Email address',
        example: 'user@outlook.com',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        description: 'App password for IMAP access',
        example: 'xxxx xxxx xxxx xxxx',
    })
    @IsString()
    @IsNotEmpty()
    appPassword: string;
}
