import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { BackgroundJobsModule } from './background-jobs/background-jobs.module';
import { AttachmentModule } from './attachment/attachment.module';
import { EmailAccountsModule } from './email-accounts/email-accounts.module';
import { EmailsModule } from './emails/emails.module';
import { SyncModule } from './sync/sync.module';
import { SearchModule } from './search/search.module';
import { ConfigModule as AppConfigModule } from './config/config.module';
import * as dotenv from 'dotenv';
dotenv.config();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Make sure this matches your file path
    }),
    PrismaModule,
    AuthModule,
    BackgroundJobsModule,
    AttachmentModule,
    EmailAccountsModule,
    EmailsModule,
    SyncModule,
    SearchModule,
    AppConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
