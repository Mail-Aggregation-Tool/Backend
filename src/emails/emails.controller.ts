import {
    Controller,
    Get,
    Param,
    Patch,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiResponse,
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
    @ApiOperation({ summary: 'Get emails with filters and pagination' })
    @ApiResponse({
        status: 200,
        description: 'Paginated list of emails',
    })
    async findAll(@GetUser('id') userId: string, @Query() query: EmailQueryDto) {
        return this.emailsService.findAll(userId, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific email' })
    @ApiResponse({
        status: 200,
        description: 'Email details',
        type: EmailResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Email not found' })
    async findOne(
        @GetUser('id') userId: string,
        @Param('id') id: string,
    ): Promise<EmailResponseDto> {
        return this.emailsService.findOne(userId, id);
    }

    @Patch(':id/read-status')
    @ApiOperation({ summary: 'Update email read status' })
    @ApiResponse({
        status: 200,
        description: 'Email read status updated',
        type: EmailResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Email not found' })
    async updateReadStatus(
        @GetUser('id') userId: string,
        @Param('id') id: string,
        @Body() updateDto: UpdateEmailReadStatusDto,
    ): Promise<EmailResponseDto> {
        return this.emailsService.updateReadStatus(userId, id, updateDto);
    }
}
