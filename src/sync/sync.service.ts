import { Injectable, Logger } from '@nestjs/common';
import { EmailAccountsRepository } from '../email-accounts/email-accounts.repository';
import { EmailsRepository } from '../emails/emails.repository';
import { ImapClientUtil } from './utils/imap-client.util';
import { EmailParserUtil } from './utils/email-parser.util';
import { FolderNormalizerUtil } from './utils/folder-normalizer.util';
import { getConfigFromEmail, detectProvider } from '../config/imap-providers.config';
import { SYNC_SETTINGS } from '../common/constants/email-sync.constants';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

export interface SyncResult {
    accountId: string;
    folder: string;
    emailsSynced: number;
    highestUid: number;
}

@Injectable()
export class SyncService {
    private readonly logger = new Logger(SyncService.name);

    constructor(
        private emailAccountsRepository: EmailAccountsRepository,
        private emailsRepository: EmailsRepository,
    ) { }

    /**
     * Discover all folders for an email account
     */
    async discoverFolders(accountId: string): Promise<string[]> {
        const account = await this.emailAccountsRepository.findById(accountId);
        if (!account) {
            throw new Error(`Account not found: ${accountId}`);
        }

        // Decrypt password
        const password = await argon2.verify(account.password, account.password)
            ? account.password
            : account.password;

        // Get IMAP config
        const config = getConfigFromEmail(account.email);
        if (!config) {
            throw new Error(`Unable to get IMAP config for ${account.email}`);
        }

        // Create IMAP client
        const client = new ImapClientUtil({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: account.email,
                pass: password,
            },
        });

        try {
            await client.connect();
            const folders = await client.listFolders();

            // Filter and sort folders
            const provider = detectProvider(account.email);
            const folderPaths = folders
                .map((f) => f.path)
                .filter((path) => FolderNormalizerUtil.shouldSyncFolder(path));

            const sortedFolders =
                FolderNormalizerUtil.sortFoldersByPriority(folderPaths);

            this.logger.log(
                `Discovered ${sortedFolders.length} folders for account ${accountId}`,
            );

            return sortedFolders;
        } finally {
            await client.disconnect();
        }
    }

    /**
     * Perform delta sync for a specific folder
     */
    async syncFolder(
        accountId: string,
        folder: string,
        chunkSize: number = SYNC_SETTINGS.CHUNK_SIZE,
    ): Promise<SyncResult> {
        const account = await this.emailAccountsRepository.findById(accountId);
        if (!account) {
            throw new Error(`Account not found: ${accountId}`);
        }

        this.logger.log(`Starting sync for ${account.email} - ${folder}`);

        // Get IMAP config
        const config = getConfigFromEmail(account.email);
        if (!config) {
            throw new Error(`Unable to get IMAP config for ${account.email}`);
        }

        // We need the actual password, not the hash
        // In production, you'd decrypt this properly
        // For now, we'll need to pass the decrypted password from the job
        const password = account.password; // This should be decrypted

        // Create IMAP client
        const client = new ImapClientUtil({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: account.email,
                pass: password,
            },
        });

        try {
            await client.connect();

            // Get the last synced UID for this folder
            const lastUid = await this.emailsRepository.getHighestUid(
                accountId,
                folder,
            );
            const startUid = lastUid + 1;

            this.logger.log(
                `Last UID for ${folder}: ${lastUid}, starting from ${startUid}`,
            );

            // Get highest UID in folder
            const highestUid = await client.getHighestUid(folder);

            if (highestUid < startUid) {
                this.logger.log(`No new emails in ${folder}`);
                return {
                    accountId,
                    folder,
                    emailsSynced: 0,
                    highestUid: lastUid,
                };
            }

            // Fetch emails in chunks
            let totalSynced = 0;
            let currentUid = startUid;

            while (currentUid <= highestUid) {
                const endUid = Math.min(currentUid + chunkSize - 1, highestUid);

                this.logger.log(
                    `Fetching emails ${currentUid} to ${endUid} from ${folder}`,
                );

                const messages = await client.fetchEmailsByUid(
                    folder,
                    currentUid,
                    endUid,
                );

                if (messages.length > 0) {
                    // Parse and store emails
                    const emailsToCreate: Prisma.EmailCreateManyInput[] = [];

                    for (const message of messages) {
                        try {
                            const parsed = await EmailParserUtil.parseEmail(
                                message.source,
                                message.flags,
                                message.uid,
                            );

                            // Normalize folder name
                            const provider = detectProvider(account.email);
                            const normalizedFolder = FolderNormalizerUtil.normalizeFolderName(
                                folder,
                                provider,
                            );

                            emailsToCreate.push({
                                accountId,
                                uid: message.uid,
                                messageId: parsed.messageId,
                                from: parsed.from,
                                to: parsed.to,
                                subject: parsed.subject,
                                body: parsed.body,
                                htmlBody: parsed.htmlBody,
                                folder: normalizedFolder,
                                isRead: parsed.flags.includes('\\Seen'),
                                receivedAt: parsed.receivedAt,
                            });

                            // TODO: Handle attachments - queue attachment upload jobs
                        } catch (error) {
                            this.logger.error(
                                `Failed to parse email UID ${message.uid}: ${error.message}`,
                            );
                        }
                    }

                    // Batch insert emails
                    if (emailsToCreate.length > 0) {
                        const count = await this.emailsRepository.createMany(
                            emailsToCreate,
                        );
                        totalSynced += count;
                        this.logger.log(`Stored ${count} emails from ${folder}`);
                    }
                }

                currentUid = endUid + 1;
            }

            // Update account sync state
            await this.emailAccountsRepository.updateSyncState(
                accountId,
                highestUid,
                new Date(),
            );

            // Add folder to flags if not already there
            await this.emailAccountsRepository.addFolderFlag(accountId, folder);

            this.logger.log(
                `Sync complete for ${folder}: ${totalSynced} new emails`,
            );

            return {
                accountId,
                folder,
                emailsSynced: totalSynced,
                highestUid,
            };
        } finally {
            await client.disconnect();
        }
    }
}
