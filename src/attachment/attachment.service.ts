import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { AttachmentRepository } from './attachment.repository';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { Attachment } from '@prisma/client';

@Injectable()
export class AttachmentService {
  constructor(
    private readonly attachmentRepository: AttachmentRepository,
  ) { }

  async uploadFile(
    file: Express.Multer.File,
    emailId: string,
  ): Promise<Attachment> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const uploadResult = await this.uploadToCloudinary(file);

    return this.attachmentRepository.create({
      email: { connect: { id: emailId } },
      filename: file.originalname,
      contentType: file.mimetype,
      size: file.size,
      storageUrl: uploadResult.secure_url,
    });
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        (error, result) => {
          if (error) return reject(error);
          if (!result) {
            return reject(new Error('Upload failed: No result returned'));
          }
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
