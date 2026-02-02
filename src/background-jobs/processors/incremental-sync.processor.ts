import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SyncService, SyncResult } from '../../sync/sync.service';
import { EmailAccountsRepository } from '../../email-accounts/email-accounts.repository';
import {
    QUEUE_NAMES,
    WORKER_SETTINGS,
    SYNC_SETTINGS,
} from '../../common/constants/email-sync.constants';

export interface IncrementalSyncJobData {
    accountId: string;
    email: string;
    folders: string[];
}

@Processor(QUEUE_NAMES.INCREMENTAL_SYNC, {
    concurrency: WORKER_SETTINGS.CONCURRENCY,
    limiter: {
        max: 20,
        duration: 60000, // 20 jobs per minute
    },
})
export class IncrementalSyncProcessor extends WorkerHost {
    private readonly logger = new Logger(IncrementalSyncProcessor.name);

    constructor(
        private syncService: SyncService,
        private emailAccountsRepository: EmailAccountsRepository,
    ) {
        super();
    }

    async process(job: Job<IncrementalSyncJobData>): Promise<any> {
        const { accountId, email, folders } = job.data;

        this.logger.log(
            `[Job ${job.id}] Starting incremental sync for account ${accountId} (${email})`,
        );

        // Check if account exists
        const account = await this.emailAccountsRepository.findById(accountId);
        if (!account) {
            this.logger.warn(
                `[Job ${job.id}] Account not found: ${accountId}. Skipping incremental sync.`
            );
            return;
        }

        try {
            const results: SyncResult[] = [];
            const progressPerFolder = 90 / folders.length;
            let currentProgress = 10;

            for (let i = 0; i < folders.length; i++) {
                const folder = folders[i];

                this.logger.log(
                    `[Job ${job.id}] Syncing folder ${i + 1}/${folders.length}: ${folder}`,
                );

                try {
                    const result = await this.syncService.syncFolder(
                        accountId,
                        folder,
                        SYNC_SETTINGS.CHUNK_SIZE,
                    );

                    results.push(result);

                    currentProgress += progressPerFolder;
                    await job.updateProgress(Math.min(currentProgress, 90));

                    if (result.emailsSynced > 0) {
                        this.logger.log(
                            `[Job ${job.id}] Synced ${result.emailsSynced} new emails from ${folder}`,
                        );
                    }
                } catch (error) {
                    this.logger.error(
                        `[Job ${job.id}] Failed to sync folder ${folder}: ${error.message}`,
                    );
                    // Continue with other folders
                }
            }

            await job.updateProgress(100);

            const totalEmails = results.reduce(
                (sum, r) => sum + r.emailsSynced,
                0,
            );

            this.logger.log(
                `[Job ${job.id}] Incremental sync complete: ${totalEmails} new emails`,
            );

            return {
                accountId,
                email,
                totalEmails,
                results,
            };
        } catch (error) {
            this.logger.error(
                `[Job ${job.id}] Incremental sync failed: ${error.message}`,
            );
            throw error;
        }
    }
}
