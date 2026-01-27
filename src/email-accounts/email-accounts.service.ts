import {
    Injectable,
    ConflictException,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EmailAccountsRepository } from './email-accounts.repository';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';
import { EmailAccountResponseDto } from './dto/email-account-response.dto';
import { ImapValidatorUtil } from './utils/imap-validator.util';
import { detectProvider } from '../config/imap-providers.config';
import { QUEUE_NAMES, JOB_TYPES } from '../common/constants/email-sync.constants';
import { EncryptionUtil } from '../common/utils/encryption.util';

@Injectable()
export class EmailAccountsService {
    private readonly logger = new Logger(EmailAccountsService.name);

    constructor(
        private emailAccountsRepository: EmailAccountsRepository,
        @InjectQueue(QUEUE_NAMES.INITIAL_SYNC) private initialSyncQueue: Queue,
        private configService: ConfigService,
    ) { }

    /**
     * Onboard a new email account
     */
    async create(
        userId: string,
        createDto: CreateEmailAccountDto,
    ): Promise<EmailAccountResponseDto> {
        const { email, appPassword } = createDto;

        // Check if account already exists
        const exists = await this.emailAccountsRepository.exists(userId, email);
        if (exists) {
            throw new ConflictException(
                'This email account is already connected to your account',
            );
        }

        // Validate IMAP connection
        this.logger.log(`Validating IMAP connection for ${email}...`);
        const validation = await ImapValidatorUtil.validateConnection(
            email,
            appPassword,
            this.configService,
        );

        if (!validation.success) {
            throw new BadRequestException(validation.error);
        }

        this.logger.log(
            `IMAP validation successful for ${email} (Provider: ${validation.provider})`,
        );

        // Encrypt password (not hash - we need to decrypt it later for IMAP)
        const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY not configured');
        }
        const encryptedPassword = EncryptionUtil.encrypt(appPassword, encryptionKey);

        // Detect provider
        const provider = detectProvider(email) || 'unknown';

        // Create account record
        const account = await this.emailAccountsRepository.create({
            user: {
                connect: { id: userId },
            },
            email,
            password: encryptedPassword,
            provider: validation.provider || provider,
            flags: [],
        });

        this.logger.log(`Email account created: ${account.id}`);

        // Queue initial sync job
        await this.initialSyncQueue.add(
            JOB_TYPES.SYNC_ACCOUNT,
            {
                accountId: account.id,
                email: account.email,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        );

        this.logger.log(`Initial sync job queued for account ${account.id}`);

        return new EmailAccountResponseDto(account);
    }

    /**
     * Connect a new email account via OAuth
     */
    async createWithOAuth(
        userId: string,
        email: string,
        accessToken: string,
        refreshToken: string,
    ): Promise<EmailAccountResponseDto> {
        // Check if account already exists
        const exists = await this.emailAccountsRepository.exists(userId, email);
        if (exists) {
            // If exists, update tokens
            const account = await this.emailAccountsRepository.findByUserAndEmail(userId, email);
            if (account) {
                await this.emailAccountsRepository.update(account.id, {
                    accessToken,
                    refreshToken,
                });

                // Trigger sync for existing account (Token refresh/Update)
                await this.initialSyncQueue.add(
                    JOB_TYPES.SYNC_ACCOUNT,
                    {
                        accountId: account.id,
                        email: account.email,
                    },
                    {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000,
                        },
                    },
                );
                this.logger.log(`Sync job queued for existing account ${account.id} (Token refresh)`);

                return new EmailAccountResponseDto(account);
            }
        }

        // Create account record
        const account = await this.emailAccountsRepository.create({
            user: {
                connect: { id: userId },
            },
            email,
            accessToken,
            refreshToken,
            provider: 'outlook', // or detect from email but usually outlook for microsoft
            flags: [],
        });

        this.logger.log(`Email account created via OAuth: ${account.id}`);

        // Queue initial sync job
        await this.initialSyncQueue.add(
            JOB_TYPES.SYNC_ACCOUNT,
            {
                accountId: account.id,
                email: account.email,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        );

        this.logger.log(`Initial sync job queued for account ${account.id}`);

        return new EmailAccountResponseDto(account);
    }

    /**
     * Get all email accounts for a user
     */
    async findAll(userId: string): Promise<EmailAccountResponseDto[]> {
        const accounts = await this.emailAccountsRepository.findByUserId(userId);
        return accounts.map((account) => new EmailAccountResponseDto(account));
    }

    /**
     * Get a specific email account
     */
    async findOne(userId: string, id: string): Promise<EmailAccountResponseDto> {
        const account = await this.emailAccountsRepository.findById(id);

        if (!account) {
            throw new NotFoundException('Email account not found');
        }

        // Ensure account belongs to user
        if (account.userId !== userId) {
            throw new NotFoundException('Email account not found');
        }

        return new EmailAccountResponseDto(account);
    }

    /**
     * Update email account
     */
    async update(
        userId: string,
        id: string,
        updateDto: UpdateEmailAccountDto,
    ): Promise<EmailAccountResponseDto> {
        const account = await this.emailAccountsRepository.findById(id);

        if (!account) {
            throw new NotFoundException('Email account not found');
        }

        // Ensure account belongs to user
        if (account.userId !== userId) {
            throw new NotFoundException('Email account not found');
        }

        // If password is being updated, validate and encrypt it
        let encryptedPassword: string | undefined;
        if (updateDto.appPassword) {
            const validation = await ImapValidatorUtil.validateConnection(
                account.email,
                updateDto.appPassword,
                this.configService,
            );

            if (!validation.success) {
                throw new BadRequestException(validation.error);
            }

            const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
            if (!encryptionKey) {
                throw new Error('ENCRYPTION_KEY not configured');
            }
            encryptedPassword = EncryptionUtil.encrypt(updateDto.appPassword, encryptionKey);
        }

        const updated = await this.emailAccountsRepository.update(id, {
            ...(encryptedPassword && { password: encryptedPassword }),
        });

        return new EmailAccountResponseDto(updated);
    }

    /**
     * Delete email account
     */
    async remove(userId: string, id: string): Promise<void> {
        const account = await this.emailAccountsRepository.findById(id);

        if (!account) {
            throw new NotFoundException('Email account not found');
        }

        // Ensure account belongs to user
        if (account.userId !== userId) {
            throw new NotFoundException('Email account not found');
        }

        await this.emailAccountsRepository.delete(id);
        this.logger.log(`Email account deleted: ${id}`);
    }
}
