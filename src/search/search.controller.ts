import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
    constructor(private readonly searchService: SearchService) { }

    @Get()
    @ApiOperation({
        summary: 'Full-text search across all user emails',
        description: 'Searches email subjects, bodies, and senders using PostgreSQL ILIKE. Case-insensitive with pagination.'
    })
    @ApiQuery({
        name: 'q',
        description: 'Search query text to find in email subject, body, and sender fields',
        required: true,
        type: 'string',
        example: 'project update'
    })
    @ApiQuery({
        name: 'page',
        description: 'Page number for pagination (starts at 1)',
        required: false,
        type: 'number',
        example: 1
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of results per page (default: 20, recommended max: 100)',
        required: false,
        type: 'number',
        example: 20
    })
    @ApiResponse({
        status: 200,
        description: 'Paginated search results matching the query',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    description: 'Array of emails matching the search criteria',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                            accountId: { type: 'string', format: 'uuid' },
                            messageId: { type: 'string', example: '<abc123@mail.gmail.com>' },
                            subject: { type: 'string', example: 'Project Update - Q1 2026' },
                            from: { type: 'string', example: 'manager@company.com' },
                            to: { type: 'array', items: { type: 'string' } },
                            body: { type: 'string', description: 'Email body content (may be truncated in list view)' },
                            receivedAt: { type: 'string', format: 'date-time', example: '2026-01-25T15:30:00Z' },
                            folder: { type: 'string', example: 'INBOX' },
                            isRead: { type: 'boolean', example: false }
                        }
                    }
                },
                total: { type: 'number', example: 42, description: 'Total number of emails matching the search query' },
                page: { type: 'number', example: 1, description: 'Current page number' },
                limit: { type: 'number', example: 20, description: 'Results per page' },
                totalPages: { type: 'number', example: 3, description: 'Total number of pages available' }
            },
            example: {
                data: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        subject: 'Project Update - Q1 2026',
                        from: 'manager@company.com',
                        receivedAt: '2026-01-25T15:30:00Z',
                        folder: 'INBOX',
                        isRead: false
                    }
                ],
                total: 42,
                page: 1,
                limit: 20,
                totalPages: 3
            }
        }
    })
    @ApiBearerAuth()
    async search(
        @GetUser('id') userId: string,
        @Query('q') query: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.searchService.searchEmails(
            userId,
            query,
            page ? Number(page) : 1,
            limit ? Number(limit) : 20,
        );
    }

    @Get('by-sender')
    @ApiOperation({
        summary: 'Search emails by sender',
        description: 'Finds all emails from specified sender. Supports partial matching on email address and display name.'
    })
    @ApiQuery({
        name: 'sender',
        description: 'Sender email address or name to search for (partial matching supported)',
        required: true,
        type: 'string',
        example: 'john@example.com'
    })
    @ApiQuery({
        name: 'page',
        description: 'Page number for pagination (starts at 1)',
        required: false,
        type: 'number',
        example: 1
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of results per page (default: 20)',
        required: false,
        type: 'number',
        example: 20
    })
    @ApiResponse({
        status: 200,
        description: 'Paginated list of emails from the specified sender',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    description: 'Emails from the specified sender',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', format: 'uuid' },
                            accountId: { type: 'string', format: 'uuid' },
                            messageId: { type: 'string' },
                            subject: { type: 'string', example: 'Weekly Newsletter' },
                            from: { type: 'string', example: 'John Doe <john@example.com>' },
                            to: { type: 'array', items: { type: 'string' } },
                            receivedAt: { type: 'string', format: 'date-time' },
                            folder: { type: 'string', example: 'INBOX' },
                            isRead: { type: 'boolean' },
                            attachments: {
                                type: 'array',
                                description: 'List of attachments (if any)',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        filename: { type: 'string' },
                                        contentType: { type: 'string' },
                                        size: { type: 'number' }
                                    }
                                }
                            }
                        }
                    }
                },
                total: { type: 'number', example: 15, description: 'Total emails from this sender' },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                totalPages: { type: 'number', example: 1 }
            },
            example: {
                data: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        subject: 'Weekly Newsletter',
                        from: 'John Doe <john@example.com>',
                        receivedAt: '2026-01-25T15:30:00Z',
                        isRead: true,
                        attachments: []
                    }
                ],
                total: 15,
                page: 1,
                limit: 20,
                totalPages: 1
            }
        }
    })
    @ApiBearerAuth()
    async searchBySender(
        @GetUser('id') userId: string,
        @Query('sender') sender: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.searchService.searchBySender(
            userId,
            sender,
            page ? Number(page) : 1,
            limit ? Number(limit) : 20,
        );
    }
}
