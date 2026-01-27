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

  // Guard against empty / whitespace-only queries
  if (!query?.trim()) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }

  const [emails, total] = await Promise.all([
    this.prisma.$queryRaw`
      SELECT e.*
      FROM "Email" e
      INNER JOIN email_fts fts ON fts.email_id = e.id
      INNER JOIN "EmailAccount" ea ON e."accountId" = ea.id
      WHERE
        ea."userId" = ${userId}
        AND e."deletedAt" IS NULL
        AND fts.search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY
        ts_rank(fts.search_vector, plainto_tsquery('english', ${query})) DESC,
        e."receivedAt" DESC
      LIMIT ${limit}
      OFFSET ${skip}
    `,
    this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Email" e
      INNER JOIN email_fts fts ON fts.email_id = e.id
      INNER JOIN "EmailAccount" ea ON e."accountId" = ea.id
      WHERE
        ea."userId" = ${userId}
        AND e."deletedAt" IS NULL
        AND fts.search_vector @@ plainto_tsquery('english', ${query})
    `,
  ]);

  const count = Number(total[0]?.count ?? 0);

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
