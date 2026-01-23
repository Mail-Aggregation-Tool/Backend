import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailAccountsService } from './email-accounts.service';
import { EmailAccountsController } from './email-accounts.controller';
import { EmailAccountsRepository } from './email-accounts.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_NAMES } from '../common/constants/email-sync.constants';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        BullModule.registerQueue({
            name: QUEUE_NAMES.INITIAL_SYNC,
        }),
    ],
    controllers: [EmailAccountsController],
    providers: [EmailAccountsService, EmailAccountsRepository],
    exports: [EmailAccountsService, EmailAccountsRepository],
})
export class EmailAccountsModule { }
