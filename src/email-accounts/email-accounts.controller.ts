import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { EmailAccountsService } from './email-accounts.service';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';
import { EmailAccountResponseDto } from './dto/email-account-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Email Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('email-accounts')
export class EmailAccountsController {
    constructor(private readonly emailAccountsService: EmailAccountsService) { }

    @Post()
    @ApiOperation({
        summary: 'Connect a new email account via IMAP',
        description: 'Validates IMAP credentials, encrypts password, creates account record, and queues initial email sync job.'
    })
    @ApiBody({
        type: CreateEmailAccountDto,
        description: 'Email account credentials (email and app password)'
    })
    @ApiResponse({
        status: 201,
        description: 'Email account successfully connected and sync job queued',
        type: EmailAccountResponseDto,
        schema: {
            example: {
                id: '550e8400-e29b-41d4-a716-446655440000',
                userId: '123e4567-e89b-12d3-a456-426614174000',
                email: 'user@gmail.com',
                provider: 'gmail',
                createdAt: '2026-01-25T15:30:00Z',
                updatedAt: '2026-01-25T15:30:00Z'
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid credentials, IMAP connection failed, or missing encryption key',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'string',
                    oneOf: [
                        { example: 'Invalid IMAP credentials' },
                        { example: 'Connection timeout - check your internet connection' },
                        { example: 'Authentication failed - verify your app password' }
                    ]
                },
                error: { type: 'string', example: 'Bad Request' }
            }
        }
    })
    @ApiResponse({
        status: 409,
        description: 'Email account already connected to this user',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                message: { type: 'string', example: 'This email account is already connected to your account' },
                error: { type: 'string', example: 'Conflict' }
            }
        }
    })
    async create(
        @GetUser('id') userId: string,
        @Body() createDto: CreateEmailAccountDto,
    ): Promise<EmailAccountResponseDto> {
        return this.emailAccountsService.create(userId, createDto);
    }

    @Get()
    @ApiOperation({
        summary: 'Get all connected email accounts',
        description: 'Returns list of all email accounts connected to the authenticated user. Passwords and tokens are excluded.'
    })
    @ApiResponse({
        status: 200,
        description: 'List of connected email accounts',
        type: [EmailAccountResponseDto],
        schema: {
            example: [
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    userId: '123e4567-e89b-12d3-a456-426614174000',
                    email: 'user@gmail.com',
                    provider: 'gmail',
                    createdAt: '2026-01-25T15:30:00Z',
                    updatedAt: '2026-01-25T15:30:00Z'
                },
                {
                    id: '660e8400-e29b-41d4-a716-446655440001',
                    userId: '123e4567-e89b-12d3-a456-426614174000',
                    email: 'work@outlook.com',
                    provider: 'outlook',
                    createdAt: '2026-01-25T16:00:00Z',
                    updatedAt: '2026-01-25T16:00:00Z'
                }
            ]
        }
    })
    async findAll(
        @GetUser('id') userId: string,
    ): Promise<EmailAccountResponseDto[]> {
        return this.emailAccountsService.findAll(userId);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get a specific email account by ID',
        description: 'Retrieves details of a specific email account. Must belong to the authenticated user.'
    })
    @ApiParam({
        name: 'id',
        description: 'Email account UUID',
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    @ApiResponse({
        status: 200,
        description: 'Email account details',
        type: EmailAccountResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Email account not found or does not belong to user',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: 'Email account not found' },
                error: { type: 'string', example: 'Not Found' }
            }
        }
    })
    async findOne(
        @GetUser('id') userId: string,
        @Param('id') id: string,
    ): Promise<EmailAccountResponseDto> {
        return this.emailAccountsService.findOne(userId, id);
    }

    @Patch(':id')
    @ApiOperation({
        summary: 'Update email account credentials',
        description: 'Updates email account credentials. Validates new password via IMAP before updating. Old credentials remain if validation fails.'
    })
    @ApiParam({
        name: 'id',
        description: 'Email account UUID to update',
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    @ApiBody({
        type: UpdateEmailAccountDto,
        description: 'Updated email account credentials'
    })
    @ApiResponse({
        status: 200,
        description: 'Email account credentials updated successfully',
        type: EmailAccountResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid credentials - new password failed IMAP validation',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: 'Invalid IMAP credentials' },
                error: { type: 'string', example: 'Bad Request' }
            }
        }
    })
    @ApiResponse({
        status: 404,
        description: 'Email account not found or does not belong to user'
    })
    async update(
        @GetUser('id') userId: string,
        @Param('id') id: string,
        @Body() updateDto: UpdateEmailAccountDto,
    ): Promise<EmailAccountResponseDto> {
        return this.emailAccountsService.update(userId, id, updateDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Disconnect and delete email account',
        description: 'Permanently removes email account connection. Associated emails may be deleted based on cascade settings. Cannot be undone.'
    })
    @ApiParam({
        name: 'id',
        description: 'Email account UUID to delete',
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    @ApiResponse({
        status: 204,
        description: 'Email account successfully deleted - no content returned'
    })
    @ApiResponse({
        status: 404,
        description: 'Email account not found or does not belong to user',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: 'Email account not found' },
                error: { type: 'string', example: 'Not Found' }
            }
        }
    })
    async remove(
        @GetUser('id') userId: string,
        @Param('id') id: string,
    ): Promise<void> {
        return this.emailAccountsService.remove(userId, id);
    }
}
