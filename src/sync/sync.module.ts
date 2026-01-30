import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { EmailAccountsModule } from '../email-accounts/email-accounts.module';
import { EmailsModule } from '../emails/emails.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [EmailAccountsModule, EmailsModule, AuthModule],
    providers: [SyncService],
    exports: [SyncService],
})
export class SyncModule { }
