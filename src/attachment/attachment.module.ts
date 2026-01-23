import { Module } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { AttachmentController } from './attachment.controller';
import { AttachmentRepository } from './attachment.repository';
import { CloudinaryProvider } from './cloudinary.provider';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AttachmentController],
  providers: [
    AttachmentService,
    AttachmentRepository,
    CloudinaryProvider,
  ],
  exports: [AttachmentService],
})
export class AttachmentModule {}
