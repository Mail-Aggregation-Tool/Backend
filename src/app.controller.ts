import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @ApiOperation({
    summary: 'API health check and welcome message',
    description: 'Returns a simple welcome message to verify the API is running and accessible. Useful for health checks and API status verification.'
  })
  @ApiResponse({
    status: 200,
    description: 'API is operational',
    schema: {
      type: 'string',
      example: 'Hello World!'
    }
  })
  @ApiExcludeEndpoint(true) // Optional: exclude from main API docs if desired
  getHello(): string {
    return this.appService.getHello();
  }
}
