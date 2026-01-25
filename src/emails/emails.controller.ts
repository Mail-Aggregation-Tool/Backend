import {
    Controller,
    Get,
    Param,
    Patch,
    Delete,
    Body,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiResponse,
    ApiParam,
    ApiBody,
    ApiQuery,
} from '@nestjs/swagger';
import { EmailsService } from './emails.service';
import { EmailQueryDto } from './dto/email-query.dto';
import { EmailResponseDto } from './dto/email-response.dto';
import { UpdateEmailReadStatusDto } from './dto/update-email-read-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Emails')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emails')
export class EmailsController {
    constructor(private readonly emailsService: EmailsService) { }

    @Get()
    @ApiOperation({
        summary: 'Get emails with advanced filtering and pagination',
        description: 'Retrieves emails with filters (account, folder, read status, date range) and pagination. Sorted by date descending.'
    })
    @ApiQuery({ name: 'accountId', required: false, type: 'string', description: 'Filter by email account UUID' })
    @ApiQuery({ name: 'folder', required: false, type: 'string', description: 'Filter by folder name (e.g., INBOX, Sent)', example: 'INBOX' })
    @ApiQuery({ name: 'isRead', required: false, type: 'boolean', description: 'Filter by read status' })
    @ApiQuery({ name: 'fromDate', required: false, type: 'string', description: 'Start date filter (ISO 8601)', example: '2026-01-01T00:00:00Z' })
    @ApiQuery({ name: 'toDate', required: false, type: 'string', description: 'End date filter (ISO 8601)', example: '2026-01-31T23:59:59Z' })
    @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number for pagination', example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Items per page', example: 20 })
    @ApiResponse({
        status: 200,
        description: 'Paginated list of emails with metadata',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                            accountId: { type: 'string', format: 'uuid' },
                            messageId: { type: 'string', example: '<abc123@mail.gmail.com>' },
                            subject: { type: 'string', example: 'Project Update - Q1 2026' },
                            from: { type: 'string', example: 'sender@example.com' },
                            to: { type: 'array', items: { type: 'string' }, example: ['recipient@example.com'] },
                            receivedAt: { type: 'string', format: 'date-time', example: '2026-01-25T15:30:00Z' },
                            folder: { type: 'string', example: 'INBOX' },
                            isRead: { type: 'boolean', example: false },
                            attachmentCount: { type: 'number', example: 2 }
                        }
                    }
                },
                total: { type: 'number', example: 150, description: 'Total emails matching filters' },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                totalPages: { type: 'number', example: 8 }
            }
        }
    })
    async findAll(@GetUser('id') userId: string, @Query() query: EmailQueryDto) {
        return this.emailsService.findAll(userId, query);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get complete details of a specific email',
        description: 'Retrieves full email details including body, headers, and attachments. Must belong to user\'s accounts.'
    })
    @ApiParam({
        name: 'id',
        description: 'Email UUID',
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    @ApiResponse({
        status: 200,
        description: 'Complete email details with body and attachments',
        type: EmailResponseDto,
        schema: {
            example: {
                id: '550e8400-e29b-41d4-a716-446655440000',
                accountId: '123e4567-e89b-12d3-a456-426614174000',
                messageId: '<abc123@mail.gmail.com>',
                subject: 'Project Update - Q1 2026',
                from: 'sender@example.com',
                to: ['recipient@example.com'],
                cc: ['cc@example.com'],
                bcc: [],
                body: '<html><body>Full email content...</body></html>',
                receivedAt: '2026-01-25T15:30:00Z',
                folder: 'INBOX',
                isRead: false,
                flags: ['\\Seen'],
                attachmentCount: 2,
                attachments: [
                    {
                        id: 'att-1',
                        filename: 'document.pdf',
                        contentType: 'application/pdf',
                        size: 1048576,
                        storageUrl: 'https://res.cloudinary.com/demo/...'
                    }
                ]
            }
        }
    })
    @ApiResponse({
        status: 404,
        description: 'Email not found or does not belong to user\'s accounts',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: 'Email not found' },
                error: { type: 'string', example: 'Not Found' }
            }
        }
    })
    async findOne(
        @GetUser('id') userId: string,
        @Param('id') id: string,
    ): Promise<EmailResponseDto> {
        return this.emailsService.findOne(userId, id);
    }

    @Patch(':id/read-status')
    @ApiOperation({
        summary: 'Mark email as read or unread',
        description: 'Updates email read status locally. Does not sync with original mail server.'
    })
    @ApiParam({
        name: 'id',
        description: 'Email UUID to update',
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    @ApiBody({
        type: UpdateEmailReadStatusDto,
        description: 'New read status for the email',
        schema: {
            example: {
                isRead: true
            }
        }
    })
    @ApiResponse({
        status: 200,
        description: 'Email read status successfully updated',
        type: EmailResponseDto,
        schema: {
            example: {
                id: '550e8400-e29b-41d4-a716-446655440000',
                accountId: '123e4567-e89b-12d3-a456-426614174000',
                subject: 'Project Update - Q1 2026',
                from: 'sender@example.com',
                isRead: true,
                receivedAt: '2026-01-25T15:30:00Z'
            }
        }
    })
    @ApiResponse({
        status: 404,
        description: 'Email not found or does not belong to user\'s accounts',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: 'Email not found' },
                error: { type: 'string', example: 'Not Found' }
            }
        }
    })
    async updateReadStatus(
        @GetUser('id') userId: string,
        @Param('id') id: string,
        @Body() updateDto: UpdateEmailReadStatusDto,
    ): Promise<EmailResponseDto> {
        return this.emailsService.updateReadStatus(userId, id, updateDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Soft delete an email',
        description: 'Marks email as deleted without removing it from database. Prevents re-syncing during background jobs. Email will no longer appear in queries.'
    })
    @ApiParam({
        name: 'id',
        description: 'Email UUID to soft delete',
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    @ApiResponse({
        status: 204,
        description: 'Email successfully soft deleted - no content returned'
    })
    @ApiResponse({
        status: 404,
        description: 'Email not found or does not belong to user\'s accounts',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: 'Email not found' },
                error: { type: 'string', example: 'Not Found' }
            }
        }
    })
    async remove(
        @GetUser('id') userId: string,
        @Param('id') id: string,
    ): Promise<void> {
        return this.emailsService.remove(userId, id);
    }
}
