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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
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
    @ApiOperation({ summary: 'Connect a new email account' })
    @ApiResponse({
        status: 201,
        description: 'Email account connected successfully',
        type: EmailAccountResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid credentials or connection failed' })
    @ApiResponse({ status: 409, description: 'Email account already exists' })
    async create(
        @GetUser('id') userId: string,
        @Body() createDto: CreateEmailAccountDto,
    ): Promise<EmailAccountResponseDto> {
        return this.emailAccountsService.create(userId, createDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all connected email accounts' })
    @ApiResponse({
        status: 200,
        description: 'List of email accounts',
        type: [EmailAccountResponseDto],
    })
    async findAll(
        @GetUser('id') userId: string,
    ): Promise<EmailAccountResponseDto[]> {
        return this.emailAccountsService.findAll(userId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific email account' })
    @ApiResponse({
        status: 200,
        description: 'Email account details',
        type: EmailAccountResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Email account not found' })
    async findOne(
        @GetUser('id') userId: string,
        @Param('id') id: string,
    ): Promise<EmailAccountResponseDto> {
        return this.emailAccountsService.findOne(userId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update email account' })
    @ApiResponse({
        status: 200,
        description: 'Email account updated successfully',
        type: EmailAccountResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Email account not found' })
    async update(
        @GetUser('id') userId: string,
        @Param('id') id: string,
        @Body() updateDto: UpdateEmailAccountDto,
    ): Promise<EmailAccountResponseDto> {
        return this.emailAccountsService.update(userId, id, updateDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete email account' })
    @ApiResponse({ status: 204, description: 'Email account deleted successfully' })
    @ApiResponse({ status: 404, description: 'Email account not found' })
    async remove(
        @GetUser('id') userId: string,
        @Param('id') id: string,
    ): Promise<void> {
        return this.emailAccountsService.remove(userId, id);
    }
}
