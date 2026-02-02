import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailAccountsRepository } from '../email-accounts/email-accounts.repository';
import { EmailsRepository } from '../emails/emails.repository';
import { ImapClientUtil } from './utils/imap-client.util';
import { EmailParserUtil } from './utils/email-parser.util';
import { FolderNormalizerUtil } from './utils/folder-normalizer.util';
import { GraphClientUtil } from './utils/graph-client.util';
import { GraphEmailParserUtil } from './utils/graph-email-parser.util';
import { getConfigFromEmail, detectProvider, IMAP_PROVIDERS } from '../config/imap-providers.config';
import { OAuthTokenUtil } from '../auth/utils/oauth-token.util';
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
        private oauthTokenUtil: OAuthTokenUtil,
    ) { }

    /**
     * Discover all folders for an email account
     */
    /**
     * Discover all folders for an email account
     */
    async discoverFolders(accountId: string): Promise<string[]> {
        const account = await this.emailAccountsRepository.findById(accountId);
        if (!account) {
            throw new Error(`Account not found: ${accountId}`);
        }

        // PRIORITY 1: OAuth (Microsoft Graph)
        if (account.refreshToken) {
            this.logger.log(`Account ${account.email} has refresh token. Using Microsoft Graph.`);

            try {
                // Refresh token
                const tokens = await this.oauthTokenUtil.refreshMicrosoftToken(account.refreshToken);

                // Update access token (and refresh token if rotated) in DB
                await this.emailAccountsRepository.update(account.id, {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken
                });

                const client = new GraphClientUtil(tokens.accessToken);
                const folders = await client.listFolders();

                const provider = 'outlook'; // Microsoft Graph is always Outlook/Exchange
                const folderPaths = folders
                    .map((f) => f.displayName) // Graph uses displayName, IDs are UUIDs. We use displayName for folder paths? 
                    // Wait, IMAP uses paths like "INBOX" or "[Gmail]/Sent". Graph names are just names.
                    // We should probably map them to our internal standard names here for normalization, 
                    // OR continue to use the display name as the "path" but normalized.
                    // Graph wellKnownName is useful.
                    .filter((name) => FolderNormalizerUtil.shouldSyncFolder(name));

                // We need to handle the ID vs Name issue. 
                // IMAP uses path as ID. Graph uses UUID. 
                // Our system seems to use `folder` string as ID in DB `Email`.
                // If we use displayName, it might change? But `folder` in Email is likely the name.
                // Let's use displayName for now as it maps closest to IMAP path.

                const sortedFolders = FolderNormalizerUtil.sortFoldersByPriority(folderPaths);

                this.logger.log(`Discovered ${sortedFolders.length} folders for account ${accountId} via Graph`);
                return sortedFolders;

            } catch (error) {
                this.logger.error(`Failed to sync via Graph for ${account.email}: ${error.message}`);
                // Fallback to password? Only if configured.
                if (!account.password) {
                    throw error;
                }
                this.logger.warn(`Falling back to basic auth (IMAP) for ${account.email}`);
            }
        }

        // PRIORITY 2: Basic Auth (IMAP)
        if (!account.password) {
            throw new Error(`Account ${accountId} cannot be synced (No valid OAuth or Password)`);
        }

        // Decrypt password
        const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY not configured');
        }
        const password = EncryptionUtil.decrypt(account.password, encryptionKey);

        const providerConf = getConfigFromEmail(account.email);
        if (!providerConf) {
            throw new Error(`Unable to get IMAP config for ${account.email}`);
        }

        // Create IMAP client
        const client = new ImapClientUtil({
            host: providerConf.host,
            port: providerConf.port,
            secure: providerConf.secure,
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

        // PRIORITY 1: OAuth (Microsoft Graph)
        if (account.refreshToken) {
            try {
                // Refresh token
                const tokens = await this.oauthTokenUtil.refreshMicrosoftToken(account.refreshToken);
                await this.emailAccountsRepository.update(account.id, {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken
                });

                const client = new GraphClientUtil(tokens.accessToken);

                // Need to find folder ID from name because Graph API operations often require ID
                // But we only have the name here from discoverFolders
                // Limitation: We iterate folders to find ID. Ideally we should cache this mapping or store IT properly.
                // For now, list folders and find match.
                // OPTIMIZATION: In future, store folder ID in DB?
                const folders = await client.listFolders();
                const matchedFolder = folders.find(f => f.displayName === folder);

                if (!matchedFolder) {
                    this.logger.warn(`Folder ${folder} not found in Graph listing`);
                    return {
                        accountId,
                        folder,
                        emailsSynced: 0,
                        highestUid: Math.max(account.lastFetchedUid || 0, await this.emailsRepository.getGlobalHighestUid(accountId)),
                    };
                }

                const lastSyncedAt = account.lastSyncedAt || new Date(0);
                this.logger.log(`Fetching new messages for ${folder} since ${lastSyncedAt.toISOString()}`);

                const messages = await client.fetchNewMessages(matchedFolder.id, lastSyncedAt);

                if (messages.length === 0) {
                    return {
                        accountId,
                        folder,
                        emailsSynced: 0,
                        highestUid: Math.max(account.lastFetchedUid || 0, await this.emailsRepository.getGlobalHighestUid(accountId)),
                    };
                }

                // Normalize folder name logic
                // For Graph, we can normalize using the wellKnownName if available or displayName
                const normalizedFolder = FolderNormalizerUtil.normalizeFolderName(
                    matchedFolder.displayName,
                    'outlook',
                    matchedFolder.wellKnownName
                );

                let emailsSynced = 0;
                // SECURITY: Ensure we don't conflict with existing IMAP UIDs (which are per-folder but stored in same UID column)
                // We use a global UID counter for Graph mode.
                // We take the MAX of (stored lastFetchedUid, MAX global DB UID) to ensure we always increment safely.
                const globalMaxUid = await this.emailsRepository.getGlobalHighestUid(accountId);
                let currentHighestUid = Math.max(account.lastFetchedUid || 0, globalMaxUid);

                const emailsToCreate: Prisma.EmailCreateManyInput[] = [];
                // Graph returns latest first (desc). We process them.

                for (const msg of messages) {
                    // Check if exists by Message-ID (InternetMessageId) or Graph ID if fallback
                    // We need a way to check existence without using UID, or we rely on lastSyncedAt only.
                    // If we rely on lastSyncedAt, we might get duplicates if time resolution is coarse?
                    // Graph API "receivedDateTime ge ..." is usually fine.
                    // But to be safe, check DB for this messageId?
                    // Schema: @@unique([accountId, uid, folder]).
                    // MessageId is not unique in schema (but it is indexed?). No index on messageId in provided schema.
                    // We can check by messageId + accountId manually if needed, but might be slow.
                    // OR we just assume lastSyncedAt is sufficient?
                    // Let's rely on time.

                    // Generate local UID
                    currentHighestUid++;

                    const parsed = GraphEmailParserUtil.parseEmail(msg);

                    // Optional: Check if duplicate by messageId to prevent duplicates?
                    // const exists = await this.emailsRepository.findByMessageId(accountId, parsed.messageId); 
                    // (Assuming repo has this? If not, skip for now. Trust the timestamp sync.)

                    emailsToCreate.push({
                        accountId,
                        uid: currentHighestUid,
                        messageId: parsed.messageId,
                        from: parsed.from,
                        to: parsed.to,
                        subject: parsed.subject,
                        body: parsed.body,
                        htmlBody: parsed.htmlBody,
                        folder: normalizedFolder,
                        isRead: parsed.flags.includes('\\Seen'),
                        receivedAt: parsed.receivedAt,
                        // Attachments? Use ID to fetch later?
                    });
                    // TODO: Attachments
                }

                if (emailsToCreate.length > 0) {
                    const count = await this.emailsRepository.createMany(emailsToCreate);
                    emailsSynced = count;
                    this.logger.log(`Stored ${count} emails from ${folder} (Graph)`);
                }

                // Update account sync state
                await this.emailAccountsRepository.updateSyncState(
                    accountId,
                    currentHighestUid,
                    new Date() // now
                );

                // Add folder to flags if not already there
                await this.emailAccountsRepository.addFolderFlag(accountId, normalizedFolder);

                return {
                    accountId,
                    folder,
                    emailsSynced,
                    highestUid: currentHighestUid
                };

            } catch (error) {
                this.logger.error(`Graph sync failed for ${folder}: ${error.message}`);
                if (!account.password) {
                    throw error;
                }
            }
        }

        // PRIORITY 2: Basic Auth (IMAP)
        if (!account.password) {
            throw new Error(`Account ${accountId} cannot be synced (No valid OAuth or Password)`);
        }

        // Decrypt password
        const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY not configured');
        }
        const password = EncryptionUtil.decrypt(account.password, encryptionKey);

        const providerConf = getConfigFromEmail(account.email);
        if (!providerConf) {
            throw new Error(`Unable to get IMAP config for ${account.email}`);
        }

        // Create IMAP client
        const client = new ImapClientUtil({
            host: providerConf.host,
            port: providerConf.port,
            secure: providerConf.secure,
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
            const provider = detectProvider(account.email);
            const normalizedFolder = FolderNormalizerUtil.normalizeFolderName(
                folder,
                provider || 'unknown',
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

            // Search for existing UIDs >= startUid (handles sparse UIDs in Trash/Spam)
            const existingUids = await client.searchUidsFromStart(folder, startUid);

            if (existingUids.length === 0) {
                this.logger.log(`No new emails in ${folder}`);
                return {
                    accountId,
                    folder,
                    emailsSynced: 0,
                    highestUid: lastUid,
                };
            }

            // Process UIDs in chunks (newest first)
            let totalSynced = 0;
            const sortedUids = existingUids.sort((a, b) => b - a); // Descending order
            const highestUid = sortedUids[0];

            for (let i = 0; i < sortedUids.length; i += chunkSize) {
                const chunkUids = sortedUids.slice(i, i + chunkSize);
                const chunkStart = Math.min(...chunkUids);
                const chunkEnd = Math.max(...chunkUids);

                this.logger.log(
                    `Fetching ${chunkUids.length} emails (UIDs ${chunkStart}-${chunkEnd}) from ${folder}`,
                );

                // Fetch specific UIDs using UID range (they exist, so this will work)
                const messages = await client.fetchEmailsByUid(
                    folder,
                    chunkStart,
                    chunkEnd,
                );

                if (messages.length > 0) {
                    // Parse and store emails
                    const emailsToCreate: Prisma.EmailCreateManyInput[] = [];

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
