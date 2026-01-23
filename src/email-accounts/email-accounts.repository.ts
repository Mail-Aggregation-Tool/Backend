import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAccount, Prisma } from '@prisma/client';

@Injectable()
export class EmailAccountsRepository {
    constructor(private prisma: PrismaService) { }

    /**
     * Create a new email account
     */
    async create(data: Prisma.EmailAccountCreateInput): Promise<EmailAccount> {
        return this.prisma.emailAccount.create({
            data,
        });
    }

    /**
     * Find email account by ID
     */
    async findById(id: string): Promise<EmailAccount | null> {
        return this.prisma.emailAccount.findUnique({
            where: { id },
        });
    }

    /**
     * Find email account by user ID and email
     */
    async findByUserAndEmail(
        userId: string,
        email: string,
    ): Promise<EmailAccount | null> {
        return this.prisma.emailAccount.findUnique({
            where: {
                userId_email: {
                    userId,
                    email,
                },
            },
        });
    }

    /**
     * Find all email accounts for a user
     */
    async findByUserId(userId: string): Promise<EmailAccount[]> {
        return this.prisma.emailAccount.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Find all active email accounts (for sync jobs)
     */
    async findAllActive(): Promise<EmailAccount[]> {
        return this.prisma.emailAccount.findMany({
            orderBy: { lastSyncedAt: 'asc' }, // Prioritize accounts that haven't been synced recently
        });
    }

    /**
     * Update email account
     */
    async update(
        id: string,
        data: Prisma.EmailAccountUpdateInput,
    ): Promise<EmailAccount> {
        return this.prisma.emailAccount.update({
            where: { id },
            data,
        });
    }

    /**
     * Update sync state
     */
    async updateSyncState(
        id: string,
        lastFetchedUid: number,
        lastSyncedAt: Date,
    ): Promise<EmailAccount> {
        return this.prisma.emailAccount.update({
            where: { id },
            data: {
                lastFetchedUid,
                lastSyncedAt,
            },
        });
    }

    /**
     * Add folder to flags array (for tracking synced folders)
     */
    async addFolderFlag(id: string, folder: string): Promise<EmailAccount> {
        const account = await this.findById(id);
        if (!account) {
            throw new Error('Email account not found');
        }

        const flags = account.flags || [];
        if (!flags.includes(folder)) {
            flags.push(folder);
        }

        return this.update(id, { flags });
    }

    /**
     * Delete email account
     */
    async delete(id: string): Promise<EmailAccount> {
        return this.prisma.emailAccount.delete({
            where: { id },
        });
    }

    /**
     * Check if account exists for user
     */
    async exists(userId: string, email: string): Promise<boolean> {
        const count = await this.prisma.emailAccount.count({
            where: {
                userId,
                email,
            },
        });
        return count > 0;
    }
}
