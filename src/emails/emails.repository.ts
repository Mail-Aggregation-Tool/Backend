import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Email, Attachment, Prisma } from '@prisma/client';

export type EmailWithAttachments = Email & {
    attachments: Attachment[];
};

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface EmailFilters {
    accountId?: string;
    folder?: string;
    isRead?: boolean;
    fromDate?: Date;
    toDate?: Date;
}

@Injectable()
export class EmailsRepository {
    constructor(private prisma: PrismaService) { }

    /**
     * Create a single email
     */
    async create(data: Prisma.EmailCreateInput): Promise<Email> {
        return this.prisma.email.create({
            data,
        });
    }

    /**
     * Batch create emails (for efficient syncing)
     */
    async createMany(data: Prisma.EmailCreateManyInput[]): Promise<number> {
        const result = await this.prisma.email.createMany({
            data,
            skipDuplicates: true, // Skip if UID already exists for account
        });
        return result.count;
    }

    /**
     * Find email by ID
     */
    async findById(id: string): Promise<EmailWithAttachments | null> {
        return this.prisma.email.findUnique({
            where: {
                id,
                deletedAt: null, // Exclude soft-deleted emails
            },
            include: {
                attachments: true,
            },
        });
    }

    /**
     * Find emails with filters and pagination
     */
    async findMany(
        userId: string,
        filters: EmailFilters,
        page: number = 1,
        limit: number = 20,
    ): Promise<PaginatedResult<EmailWithAttachments>> {
        const skip = (page - 1) * limit;

        // Build where clause
        const where: Prisma.EmailWhereInput = {
            account: {
                userId,
            },
            deletedAt: null, // Exclude soft-deleted emails
            ...(filters.accountId && { accountId: filters.accountId }),
            ...(filters.folder && { folder: filters.folder }),
            ...(filters.isRead !== undefined && { isRead: filters.isRead }),
            ...(filters.fromDate && {
                receivedAt: { gte: filters.fromDate },
            }),
            ...(filters.toDate && {
                receivedAt: { lte: filters.toDate },
            }),
        };

        // Execute queries in parallel
        const [data, total] = await Promise.all([
            this.prisma.email.findMany({
                where,
                skip,
                take: limit,
                orderBy: { receivedAt: 'desc' },
                include: {
                    attachments: true,
                },
            }),
            this.prisma.email.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Update email read status
     */
    async updateReadStatus(id: string, isRead: boolean): Promise<Email> {
        return this.prisma.email.update({
            where: { id },
            data: { isRead },
        });
    }

    /**
     * Check if email exists by UID, folder and account (including soft-deleted)
     */
    async existsByUidAndAccount(
        uid: number,
        folder: string,
        accountId: string,
    ): Promise<boolean> {
        const count = await this.prisma.email.count({
            where: {
                uid,
                folder,
                accountId,
            },
        });
        return count > 0;
    }

    /**
     * Get highest UID for an account and folder
     */
    async getHighestUid(accountId: string, folder: string): Promise<number> {
        const result = await this.prisma.email.findFirst({
            where: {
                accountId,
                folder,
            },
            orderBy: {
                uid: 'desc',
            },
            select: {
                uid: true,
            },
        });

        return result?.uid || 0;
    }

    /**
     * Get email count by folder for an account
     */
    async getCountByFolder(
        accountId: string,
    ): Promise<{ folder: string; count: number }[]> {
        const result = await this.prisma.email.groupBy({
            by: ['folder'],
            where: { accountId },
            _count: {
                folder: true,
            },
        });

        return result.map((item) => ({
            folder: item.folder,
            count: item._count.folder,
        }));
    }

    /**
     * Soft delete an email
     */
    async softDelete(id: string): Promise<Email> {
        return this.prisma.email.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    /**
     * Delete emails by account ID
     */
    async deleteByAccountId(accountId: string): Promise<number> {
        const result = await this.prisma.email.deleteMany({
            where: { accountId },
        });
        return result.count;
    }
}
