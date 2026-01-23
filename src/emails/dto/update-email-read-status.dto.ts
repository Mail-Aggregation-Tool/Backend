import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailReadStatusDto {
    @ApiProperty({ description: 'Read status' })
    @IsBoolean()
    isRead: boolean;
}
