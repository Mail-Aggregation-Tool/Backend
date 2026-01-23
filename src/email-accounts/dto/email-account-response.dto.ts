import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class EmailAccountResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    userId: string;

    @ApiProperty()
    email: string;

    @ApiProperty()
    provider: string;

    @Exclude()
    password: string;

    @ApiProperty({ nullable: true })
    lastFetchedUid: number | null;

    @ApiProperty({ nullable: true })
    lastSyncedAt: Date | null;

    @ApiProperty()
    flags: string[];

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    constructor(partial: Partial<EmailAccountResponseDto>) {
        Object.assign(this, partial);
    }
}
