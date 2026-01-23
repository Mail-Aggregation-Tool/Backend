import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SyncService, SyncResult } from '../../sync/sync.service';
import {
    QUEUE_NAMES,
    WORKER_SETTINGS,
    SYNC_SETTINGS,
} from '../../common/constants/email-sync.constants';

export interface InitialSyncJobData {
    accountId: string;
    email: string;
}

@Processor(QUEUE_NAMES.INITIAL_SYNC, {
    concurrency: WORKER_SETTINGS.CONCURRENCY,
    limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute
    },
})
export class InitialSyncProcessor extends WorkerHost {
    private readonly logger = new Logger(InitialSyncProcessor.name);

    constructor(private syncService: SyncService) {
        super();
    }

    async process(job: Job<InitialSyncJobData>): Promise<any> {
        const { accountId, email } = job.data;

        this.logger.log(
            `[Job ${job.id}] Starting initial sync for account ${accountId} (${email})`,
        );

        try {
            // Step 1: Discover folders
            await job.updateProgress(10);
            this.logger.log(`[Job ${job.id}] Discovering folders...`);

            const folders = await this.syncService.discoverFolders(accountId);

            this.logger.log(
                `[Job ${job.id}] Found ${folders.length} folders to sync`,
            );

            // Step 2: Sync each folder
            const results: SyncResult[] = [];
            const progressPerFolder = 80 / folders.length;
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
                        SYNC_SETTINGS.INITIAL_SYNC_CHUNK_SIZE,
                    );

                    results.push(result);

                    currentProgress += progressPerFolder;
                    await job.updateProgress(Math.min(currentProgress, 90));

                    this.logger.log(
                        `[Job ${job.id}] Synced ${result.emailsSynced} emails from ${folder}`,
                    );
                } catch (error) {
                    this.logger.error(
                        `[Job ${job.id}] Failed to sync folder ${folder}: ${error.message}`,
                    );
                    // Continue with other folders even if one fails
                }
            }

            await job.updateProgress(100);

            const totalEmails = results.reduce(
                (sum, r) => sum + r.emailsSynced,
                0,
            );

            this.logger.log(
                `[Job ${job.id}] Initial sync complete: ${totalEmails} total emails synced`,
            );

            return {
                accountId,
                email,
                totalEmails,
                foldersSynced: results.length,
                results,
            };
        } catch (error) {
            this.logger.error(
                `[Job ${job.id}] Initial sync failed: ${error.message}`,
            );
            throw error;
        }
    }
}
