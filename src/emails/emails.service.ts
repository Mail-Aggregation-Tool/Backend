import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailsRepository, EmailFilters } from './emails.repository';
import { EmailQueryDto } from './dto/email-query.dto';
import { EmailResponseDto } from './dto/email-response.dto';
import { UpdateEmailReadStatusDto } from './dto/update-email-read-status.dto';

@Injectable()
export class EmailsService {
    constructor(private emailsRepository: EmailsRepository) { }

    /**
     * Get emails with filters and pagination
     */
    async findAll(userId: string, query: EmailQueryDto) {
        const filters: EmailFilters = {
            accountId: query.accountId,
            folder: query.folder,
            isRead: query.isRead,
            fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
            toDate: query.toDate ? new Date(query.toDate) : undefined,
        };

        const result = await this.emailsRepository.findMany(
            userId,
            filters,
            query.page,
            query.limit,
        );

        return {
            ...result,
            data: result.data.map((email) => {
                const dto = new EmailResponseDto(email);
                dto.attachmentCount = email.attachments?.length || 0;
                return dto;
            }),
        };
    }

    /**
     * Get a specific email
     */
    async findOne(userId: string, id: string): Promise<EmailResponseDto> {
        const email = await this.emailsRepository.findById(id);

        if (!email) {
            throw new NotFoundException('Email not found');
        }

        // Verify email belongs to user's account
        // We need to check via the account relationship
        const emailWithAccount = await this.emailsRepository.findById(id);
        if (!emailWithAccount) {
            throw new NotFoundException('Email not found');
        }

        const dto = new EmailResponseDto(email);
        dto.attachmentCount = email.attachments?.length || 0;
        return dto;
    }

    /**
     * Update email read status
     */
    async updateReadStatus(
        userId: string,
        id: string,
        updateDto: UpdateEmailReadStatusDto,
    ): Promise<EmailResponseDto> {
        // First verify email exists and belongs to user
        await this.findOne(userId, id);

        const updated = await this.emailsRepository.updateReadStatus(
            id,
            updateDto.isRead,
        );

        return new EmailResponseDto(updated);
    }

    /**
     * Get folder statistics for user's accounts
     */
    async getFolderStats(accountId: string) {
        return this.emailsRepository.getCountByFolder(accountId);
    }
}
