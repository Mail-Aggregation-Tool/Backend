import { Module } from '@nestjs/common';
import { EmailsService } from './emails.service';
import { EmailsController } from './emails.controller';
import { EmailsRepository } from './emails.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [EmailsController],
    providers: [EmailsService, EmailsRepository],
    exports: [EmailsService, EmailsRepository],
})
export class EmailsModule { }
