import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
    @ApiOperation({ summary: 'Search emails by query' })
    @ApiQuery({ name: 'q', description: 'Search query', required: true })
    @ApiQuery({ name: 'page', description: 'Page number', required: false })
    @ApiQuery({ name: 'limit', description: 'Items per page', required: false })
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
    @ApiOperation({ summary: 'Search emails by sender' })
    @ApiQuery({ name: 'sender', description: 'Sender email or name', required: true })
    @ApiQuery({ name: 'page', description: 'Page number', required: false })
    @ApiQuery({ name: 'limit', description: 'Items per page', required: false })
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
