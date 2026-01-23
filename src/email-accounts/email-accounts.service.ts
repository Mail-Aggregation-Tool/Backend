import {
    Injectable,
    ConflictException,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailAccountsRepository } from './email-accounts.repository';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';
import { EmailAccountResponseDto } from './dto/email-account-response.dto';
import { ImapValidatorUtil } from './utils/imap-validator.util';
import { detectProvider } from '../config/imap-providers.config';
import { QUEUE_NAMES, JOB_TYPES } from '../common/constants/email-sync.constants';
import * as argon2 from 'argon2';

@Injectable()
export class EmailAccountsService {
    private readonly logger = new Logger(EmailAccountsService.name);

    constructor(
        private emailAccountsRepository: EmailAccountsRepository,
        @InjectQueue(QUEUE_NAMES.INITIAL_SYNC) private initialSyncQueue: Queue,
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
        );

        if (!validation.success) {
            throw new BadRequestException(validation.error);
        }

        this.logger.log(
            `IMAP validation successful for ${email} (Provider: ${validation.provider})`,
        );

        // Encrypt password
        const hashedPassword = await argon2.hash(appPassword);

        // Detect provider
        const provider = detectProvider(email) || 'unknown';

        // Create account record
        const account = await this.emailAccountsRepository.create({
            user: {
                connect: { id: userId },
            },
            email,
            password: hashedPassword,
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

        // If password is being updated, validate and hash it
        let hashedPassword: string | undefined;
        if (updateDto.appPassword) {
            const validation = await ImapValidatorUtil.validateConnection(
                account.email,
                updateDto.appPassword,
            );

            if (!validation.success) {
                throw new BadRequestException(validation.error);
            }

            hashedPassword = await argon2.hash(updateDto.appPassword);
        }

        const updated = await this.emailAccountsRepository.update(id, {
            ...(hashedPassword && { password: hashedPassword }),
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
