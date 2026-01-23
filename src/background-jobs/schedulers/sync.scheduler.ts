import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailAccountsRepository } from '../../email-accounts/email-accounts.repository';
import {
    QUEUE_NAMES,
    JOB_TYPES,
} from '../../common/constants/email-sync.constants';

@Injectable()
export class SyncScheduler {
    private readonly logger = new Logger(SyncScheduler.name);

    constructor(
        private emailAccountsRepository: EmailAccountsRepository,
        @InjectQueue(QUEUE_NAMES.INCREMENTAL_SYNC)
        private incrementalSyncQueue: Queue,
    ) { }

    /**
     * Schedule incremental sync every 5 minutes
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async scheduleIncrementalSync() {
        this.logger.log('Running scheduled incremental sync...');

        try {
            // Get all active accounts
            const accounts = await this.emailAccountsRepository.findAllActive();

            this.logger.log(
                `Found ${accounts.length} accounts to sync incrementally`,
            );

            for (const account of accounts) {
                // Get folders from flags array (folders that have been synced before)
                const folders = account.flags || [];

                if (folders.length === 0) {
                    this.logger.warn(
                        `Account ${account.id} has no synced folders, skipping`,
                    );
                    continue;
                }

                // Queue incremental sync job
                await this.incrementalSyncQueue.add(
                    JOB_TYPES.SYNC_ACCOUNT,
                    {
                        accountId: account.id,
                        email: account.email,
                        folders,
                    },
                    {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000,
                        },
                        removeOnComplete: {
                            age: 3600, // Keep completed jobs for 1 hour
                            count: 100,
                        },
                        removeOnFail: {
                            age: 86400, // Keep failed jobs for 24 hours
                        },
                    },
                );

                this.logger.log(
                    `Queued incremental sync for account ${account.id} (${folders.length} folders)`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to schedule incremental sync: ${error.message}`,
            );
        }
    }
}
