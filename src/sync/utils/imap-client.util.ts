import { ImapFlow, ImapFlowOptions } from 'imapflow';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMAP_SETTINGS } from '../../common/constants/email-sync.constants';
import { CertificateLoader } from './cert-loader.util';

export interface ImapConnectionConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
}

export interface FolderInfo {
    path: string;
    delimiter: string;
    flags: Set<string>;
    specialUse?: string;
}

export interface EmailMessage {
    uid: number;
    flags: Set<string>;
    envelope: any;
    bodyStructure: any;
    source: Buffer;
}

export class ImapClientUtil {
    private client: ImapFlow | null = null;
    private readonly logger = new Logger(ImapClientUtil.name);
    private reconnectAttempts = 0;

    constructor(
        private readonly config: ImapConnectionConfig,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Connect to IMAP server
     */
    async connect(): Promise<void> {
        try {
            // Load SSL certificates for secure connections
            let certificates: Buffer[] = [];
            try {
                certificates = await CertificateLoader.loadCertificates();
                if (certificates.length > 0) {
                    this.logger.debug(
                        `Loaded ${certificates.length} SSL certificate(s) for IMAP connection`,
                    );
                }
            } catch (certError) {
                this.logger.warn(
                    `Certificate loading failed: ${certError.message}. Proceeding without custom certificates.`,
                );
            }

            const tls = this.configService.get('TLS')

            const options: ImapFlowOptions = {
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure, // must match port (993 for SSL)
                auth: this.config.auth,
                connectionTimeout: IMAP_SETTINGS.TIMEOUT,
                greetingTimeout: IMAP_SETTINGS.TIMEOUT,
                ...(this.config.secure
                    ? {
                        tls: {
                            rejectUnauthorized: tls, // false in dev, true in prod
                        },
                    }
                    : {}),
            };


            this.client = new ImapFlow(options);

            this.client.on('error', (err) => {
                this.logger.error(`IMAP connection error: ${err.message}`);
            });

            this.client.on('close', () => {
                this.logger.log('IMAP connection closed');
            });

            await this.client.connect();
            this.reconnectAttempts = 0;
            this.logger.log(
                `Connected to IMAP server: ${this.config.host}:${this.config.port}`,
            );
        } catch (error) {
            this.logger.error(`Failed to connect to IMAP: ${error.message}`);
            throw error;
        }
    }

    /**
     * Disconnect from IMAP server
     */
    async disconnect(): Promise<void> {
        if (this.client) {
            try {
                await this.client.logout();
                this.client = null;
                this.logger.log('Disconnected from IMAP server');
            } catch (error) {
                this.logger.error(`Error during disconnect: ${error.message}`);
                this.client = null;
            }
        }
    }

    /**
     * Ensure connection is active, reconnect if needed
     */
    private async ensureConnection(): Promise<void> {
        if (!this.client || this.client.usable === false) {
            if (this.reconnectAttempts >= IMAP_SETTINGS.MAX_RECONNECT_ATTEMPTS) {
                throw new Error('Max reconnection attempts reached');
            }

            this.logger.warn('Connection lost, attempting to reconnect...');
            this.reconnectAttempts++;

            await new Promise((resolve) =>
                setTimeout(resolve, IMAP_SETTINGS.RECONNECT_DELAY),
            );
            await this.connect();
        }
    }

    /**
     * List all folders/mailboxes
     */
    async listFolders(): Promise<FolderInfo[]> {
        await this.ensureConnection();

        try {
            const list = await this.client!.list();
            return list.map((folder) => ({
                path: folder.path,
                delimiter: folder.delimiter,
                flags: new Set(folder.flags),
                specialUse: folder.specialUse,
            }));
        } catch (error) {
            this.logger.error(`Failed to list folders: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetch emails by UID range
     * @param folder - Folder path
     * @param uidStart - Starting UID (inclusive)
     * @param uidEnd - Ending UID (inclusive), use '*' for latest
     */
    async fetchEmailsByUid(
        folder: string,
        uidStart: number,
        uidEnd: number | string = '*',
    ): Promise<EmailMessage[]> {
        await this.ensureConnection();

        try {
            // Lock the mailbox
            const lock = await this.client!.getMailboxLock(folder);

            try {
                const messages: EmailMessage[] = [];

                // Fetch messages
                for await (const message of this.client!.fetch(
                    `${uidStart}:${uidEnd}`,
                    {
                        uid: true,
                        flags: true,
                        envelope: true,
                        bodyStructure: true,
                        source: true,
                    },
                    { uid: true },
                )) {
                    messages.push({
                        uid: message.uid,
                        flags: message.flags ?? new Set<string>(),
                        envelope: message.envelope,
                        bodyStructure: message.bodyStructure,
                        source: message.source ?? Buffer.from(''),
                    });
                }

                return messages;
            } finally {
                lock.release();
            }
        } catch (error) {
            this.logger.error(
                `Failed to fetch emails from ${folder}: ${error.message}`,
            );
            throw error;
        }
    }

    /**
     * Get the highest UID in a folder
     */
    async getHighestUid(folder: string): Promise<number> {
        await this.ensureConnection();

        try {
            const lock = await this.client!.getMailboxLock(folder);

            try {
                const status = await this.client!.status(folder, {
                    uidNext: true,
                });

                // uidNext is the next UID that will be assigned, so highest is uidNext - 1
                return status.uidNext ? status.uidNext - 1 : 0;
            } finally {
                lock.release();
            }
        } catch (error) {
            this.logger.error(
                `Failed to get highest UID for ${folder}: ${error.message}`,
            );
            return 0;
        }
    }

    /**
     * Test connection (used for validation)
     */
    static async testConnection(
        config: ImapConnectionConfig,
        configService: ConfigService,
    ): Promise<{ success: boolean; error?: string }> {
        const client = new ImapClientUtil(config, configService);

        try {
            await client.connect();
            await client.disconnect();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Unknown error',
            };
        }
    }

    /**
     * Check if client is connected
     */
    isConnected(): boolean {
        return this.client !== null && this.client.usable;
    }
}
