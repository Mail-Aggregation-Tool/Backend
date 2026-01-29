import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailAccountsRepository } from '../email-accounts/email-accounts.repository';
import { EmailsRepository } from '../emails/emails.repository';
import { ImapClientUtil } from './utils/imap-client.util';
import { EmailParserUtil } from './utils/email-parser.util';
import { FolderNormalizerUtil } from './utils/folder-normalizer.util';
import { getConfigFromEmail, detectProvider } from '../config/imap-providers.config';
import { SYNC_SETTINGS } from '../common/constants/email-sync.constants';
import { Prisma } from '@prisma/client';
import { EncryptionUtil } from '../common/utils/encryption.util';

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
        private configService: ConfigService,
    ) { }

    /**
     * Discover all folders for an email account
     */
    async discoverFolders(accountId: string): Promise<string[]> {
        const account = await this.emailAccountsRepository.findById(accountId);
        if (!account) {
            throw new Error(`Account not found: ${accountId}`);
        }

        // Decrypt password for IMAP authentication
        const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY not configured');
        }
        if (!account.password) {
            throw new Error(`Account ${accountId} uses OAuth and cannot be synced via IMAP with password`);
        }
        const password = EncryptionUtil.decrypt(account.password, encryptionKey);

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
        }, this.configService);

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

        // Decrypt password for IMAP authentication
        const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY not configured');
        }
        if (!account.password) {
            throw new Error(`Account ${accountId} uses OAuth and cannot be synced via IMAP with password`);
        }
        const password = EncryptionUtil.decrypt(account.password, encryptionKey);

        // Create IMAP client
        const client = new ImapClientUtil({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: account.email,
                pass: password,
            },
        }, this.configService);

        try {
            await client.connect();

            // Get folder metadata for normalization
            const folderMetadata = await client.getFolderMetadata(folder);

            // Normalize folder name BEFORE querying for highest UID
            // This ensures we query with the same folder name that emails are stored with
            const provider = detectProvider(account.email);
            const normalizedFolder = FolderNormalizerUtil.normalizeFolderName(
                folder,
                provider,
                folderMetadata.specialUse,
                folderMetadata.flags,
            );

            // Get the last synced UID for this folder (using normalized folder name)
            const lastUid = await this.emailsRepository.getHighestUid(
                accountId,
                normalizedFolder,
            );
            const startUid = lastUid + 1;

            this.logger.log(
                `Last UID for ${folder} (normalized: ${normalizedFolder}): ${lastUid}, starting from ${startUid}`,
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

            // Fetch emails in chunks (newest first)
            let totalSynced = 0;
            let currentUid = highestUid;

            while (currentUid >= startUid) {
                // inclusive start of chunk
                const chunkStartUid = Math.max(currentUid - chunkSize + 1, startUid);

                this.logger.log(
                    `Fetching emails ${chunkStartUid} to ${currentUid} from ${folder}`,
                );

                const messages = await client.fetchEmailsByUid(
                    folder,
                    chunkStartUid,
                    currentUid,
                );

                this.logger.log(
                    `[DEBUG] Fetched ${messages.length} messages from ${folder} (UIDs ${chunkStartUid}-${currentUid})`,
                );

                if (messages.length > 0) {
                    // Parse and store emails
                    const emailsToCreate: Prisma.EmailCreateManyInput[] = [];
                    let skippedExisting = 0;
                    let skippedParseError = 0;

                    for (const message of messages.reverse()) {
                        try {
                            // Check if email exists and is soft-deleted
                            const exists = await this.emailsRepository.existsByUidFolderAndAccount(
                                message.uid,
                                normalizedFolder,
                                accountId,
                            );

                            if (exists) {
                                // Email exists (possibly soft-deleted), skip to prevent re-creation
                                skippedExisting++;
                                this.logger.log(
                                    `[DEBUG] Skipping UID ${message.uid} in folder "${normalizedFolder}" - already exists`,
                                );
                                continue;
                            }

                            const parsed = await EmailParserUtil.parseEmail(
                                message.source,
                                message.flags,
                                message.uid,
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
                            skippedParseError++;
                            this.logger.error(
                                `Failed to parse email UID ${message.uid}: ${error.message}`,
                            );
                        }
                    }

                    this.logger.log(
                        `[DEBUG] Chunk summary for ${folder}: fetched=${messages.length}, skippedExisting=${skippedExisting}, skippedParseError=${skippedParseError}, toCreate=${emailsToCreate.length}`,
                    );

                    // Batch insert emails
                    if (emailsToCreate.length > 0) {
                        const count = await this.emailsRepository.createMany(
                            emailsToCreate,
                        );
                        totalSynced += count;
                        this.logger.log(`Stored ${count} emails from ${folder} (expected ${emailsToCreate.length})`);
                    }
                }

                currentUid = chunkStartUid - 1;
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
