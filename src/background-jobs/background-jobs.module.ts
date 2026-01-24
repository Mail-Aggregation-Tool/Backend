import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../common/constants/email-sync.constants';
import { InitialSyncProcessor } from './processors/initial-sync.processor';
import { IncrementalSyncProcessor } from './processors/incremental-sync.processor';
import { SyncScheduler } from './schedulers/sync.scheduler';
import { SyncModule } from '../sync/sync.module';
import { EmailAccountsModule } from '../email-accounts/email-accounts.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RedisConnection');

        const host = configService.get<string>('REDIS_HOST');
        const port = Number(configService.get<number>('REDIS_PORT'));

        const username = configService.get<string>('REDIS_USERNAME');
        const password = configService.get<string>('REDIS_PASSWORD');

        const isRedisCloud = !!password; // Redis Cloud always has auth

        const connection: any = {
          host,
          port,
        };

        if (isRedisCloud) {
          connection.username = username ?? 'default';
          connection.password = password;
          connection.tls = {
            servername: host,
            rejectUnauthorized: true,
          }; // REQUIRED for Redis Cloud

          logger.log(
            `✅ Redis Cloud connected at ${host}:${port} (TLS enabled)`
          );
        } else {
          logger.log(`✅ Redis connected at ${host}:${port}`);
        }

        return { connection };
      },
    }),

    BullModule.registerQueue(
      { name: QUEUE_NAMES.INITIAL_SYNC },
      { name: QUEUE_NAMES.INCREMENTAL_SYNC },
      { name: QUEUE_NAMES.ATTACHMENT_UPLOAD },
    ),

    SyncModule,
    EmailAccountsModule,
  ],
  providers: [
    InitialSyncProcessor,
    IncrementalSyncProcessor,
    SyncScheduler,
  ],
  exports: [BullModule],
})
export class BackgroundJobsModule {}
