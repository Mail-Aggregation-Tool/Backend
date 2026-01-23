import { IsOptional, IsString, IsBoolean, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EmailQueryDto {
    @ApiPropertyOptional({ description: 'Filter by folder name' })
    @IsOptional()
    @IsString()
    folder?: string;

    @ApiPropertyOptional({ description: 'Filter by read status' })
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isRead?: boolean;

    @ApiPropertyOptional({ description: 'Filter by account ID' })
    @IsOptional()
    @IsString()
    accountId?: string;

    @ApiPropertyOptional({ description: 'Filter emails from this date' })
    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @ApiPropertyOptional({ description: 'Filter emails to this date' })
    @IsOptional()
    @IsDateString()
    toDate?: string;

    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;
}
