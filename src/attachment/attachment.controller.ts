import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentService } from './attachment.service';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiCreatedResponse,
} from '@nestjs/swagger';

@ApiTags('Attachments')
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload an attachment linked to an email' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        emailId: { type: 'string', format: 'uuid', description: 'ID of the email associated with this attachment' },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['emailId', 'file'],
    },
  })
  @ApiCreatedResponse({ description: 'The attachment has been successfully uploaded.' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('emailId', ParseUUIDPipe) emailId: string,
  ) {
    return this.attachmentService.uploadFile(file, emailId);
  }
}
