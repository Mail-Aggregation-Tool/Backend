
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
            useFactory: async (configService: ConfigService) => {
                const logger = new Logger('RedisConnection');
                const host = configService.get<string>('REDIS_HOST');
                const port = configService.get<number>('REDIS_PORT');

                logger.log(`✅ Redis connected successfully at ${host}:${port}`);

                return {
                    connection: {
                        host,
                        port,
                    },
                };
            },
            inject: [ConfigService],
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
export class BackgroundJobsModule { }
