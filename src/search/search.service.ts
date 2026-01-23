import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Full-text search across emails using Postgres FTS
     * @param userId - User ID
     * @param query - Search query
     * @param page - Page number
     * @param limit - Items per page
     */
    async searchEmails(
        userId: string,
        query: string,
        page: number = 1,
        limit: number = 20,
    ) {
        const skip = (page - 1) * limit;

        // Use Postgres full-text search on subject and body
        // This uses the @@ operator for text search
        const searchQuery = `%${query}%`;

        const [emails, total] = await Promise.all([
            this.prisma.$queryRaw`
        SELECT e.*
        FROM "Email" e
        INNER JOIN "EmailAccount" ea ON e."accountId" = ea.id
        WHERE ea."userId" = ${userId}
        AND (
          e.subject ILIKE ${searchQuery}
          OR e.body ILIKE ${searchQuery}
          OR e."from" ILIKE ${searchQuery}
        )
        ORDER BY e."receivedAt" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `,
            this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::int as count
        FROM "Email" e
        INNER JOIN "EmailAccount" ea ON e."accountId" = ea.id
        WHERE ea."userId" = ${userId}
        AND (
          e.subject ILIKE ${searchQuery}
          OR e.body ILIKE ${searchQuery}
          OR e."from" ILIKE ${searchQuery}
        )
      `,
        ]);

        const count = Number(total[0]?.count || 0);

        return {
            data: emails,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        };
    }

    /**
     * Search emails by sender
     */
    async searchBySender(
        userId: string,
        sender: string,
        page: number = 1,
        limit: number = 20,
    ) {
        const skip = (page - 1) * limit;

        const [emails, total] = await Promise.all([
            this.prisma.email.findMany({
                where: {
                    account: {
                        userId,
                    },
                    from: {
                        contains: sender,
                        mode: 'insensitive',
                    },
                },
                skip,
                take: limit,
                orderBy: { receivedAt: 'desc' },
                include: {
                    attachments: {
                        select: {
                            id: true,
                            filename: true,
                            contentType: true,
                            size: true,
                        },
                    },
                },
            }),
            this.prisma.email.count({
                where: {
                    account: {
                        userId,
                    },
                    from: {
                        contains: sender,
                        mode: 'insensitive',
                    },
                },
            }),
        ]);

        return {
            data: emails,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
}
