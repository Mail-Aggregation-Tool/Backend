import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Attachment, Prisma } from '@prisma/client';

@Injectable()
export class AttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.AttachmentCreateInput): Promise<Attachment> {
    return this.prisma.attachment.create({
      data,
    });
  }

}
