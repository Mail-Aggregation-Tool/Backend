import { ApiProperty } from '@nestjs/swagger';

export class EmailResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    accountId: string;

    @ApiProperty()
    uid: number;

    @ApiProperty({ nullable: true })
    messageId: string | null;

    @ApiProperty()
    from: string;

    @ApiProperty({ type: [String] })
    to: string[];

    @ApiProperty()
    subject: string;

    @ApiProperty()
    body: string;

    @ApiProperty({ nullable: true })
    htmlBody: string | null;

    @ApiProperty()
    folder: string;

    @ApiProperty()
    isRead: boolean;

    @ApiProperty()
    receivedAt: Date;

    @ApiProperty()
    fetchedAt: Date;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty({ required: false })
    attachmentCount?: number;

    constructor(partial: Partial<EmailResponseDto>) {
        Object.assign(this, partial);
    }
}
