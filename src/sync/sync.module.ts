import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { EmailAccountsModule } from '../email-accounts/email-accounts.module';
import { EmailsModule } from '../emails/emails.module';

@Module({
    imports: [EmailAccountsModule, EmailsModule],
    providers: [SyncService],
    exports: [SyncService],
})
export class SyncModule { }
