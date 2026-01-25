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
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

@ApiTags('Attachments')
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) { }

  @Post('upload')
  @ApiOperation({
    summary: 'Upload an email attachment to cloud storage',
    description: 'Uploads file attachment to Cloudinary, creates database record with metadata, and returns secure storage URL.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File upload payload with email association',
    schema: {
      type: 'object',
      required: ['emailId', 'file'],
      properties: {
        emailId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the email this attachment belongs to',
          example: '550e8400-e29b-41d4-a716-446655440000'
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'The file to upload (all file types supported)',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Attachment successfully uploaded and stored',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174000',
          description: 'Unique identifier for the attachment'
        },
        emailId: {
          type: 'string',
          format: 'uuid',
          example: '550e8400-e29b-41d4-a716-446655440000',
          description: 'ID of the associated email'
        },
        filename: {
          type: 'string',
          example: 'document.pdf',
          description: 'Original filename of the uploaded file'
        },
        contentType: {
          type: 'string',
          example: 'application/pdf',
          description: 'MIME type of the file'
        },
        size: {
          type: 'number',
          example: 1048576,
          description: 'File size in bytes'
        },
        storageUrl: {
          type: 'string',
          example: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.pdf',
          description: 'Secure HTTPS URL to access the file on Cloudinary'
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2026-01-25T15:30:00Z',
          description: 'Timestamp when the attachment was uploaded'
        }
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing file or invalid email ID format',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          oneOf: [
            { example: 'No file uploaded' },
            { example: 'Validation failed (uuid is expected)' }
          ]
        },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Email with the provided ID does not exist',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Email not found' },
        error: { type: 'string', example: 'Not Found' }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('emailId', ParseUUIDPipe) emailId: string,
  ) {
    return this.attachmentService.uploadFile(file, emailId);
  }
}
