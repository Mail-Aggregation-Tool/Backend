import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConfigFromEmail } from '../../config/imap-providers.config';
import { ImapClientUtil } from '../../sync/utils/imap-client.util';

export interface ValidationResult {
    success: boolean;
    provider: string | null;
    error?: string;
}

@Injectable()
export class ImapValidatorUtil {
    /**
     * Validate IMAP connection with email and password
     * @param email - User's email address
     * @param password - App password
     * @param configService - ConfigService instance
     * @returns Validation result with provider info
     */
    static async validateConnection(
        email: string,
        password: string,
        configService: ConfigService,
    ): Promise<ValidationResult> {
        // Get IMAP config from email
        const config = getConfigFromEmail(email);

        if (!config) {
            return {
                success: false,
                provider: null,
                error:
                    'Unable to detect email provider. Please ensure you are using a supported provider (Gmail, Outlook, Yahoo, iCloud, AOL).',
            };
        }

        // Extract provider name from email
        const domain = email.split('@')[1]?.toLowerCase();
        let provider = 'unknown';

        if (domain === 'gmail.com') provider = 'Gmail';
        else if (domain === 'outlook.com' || domain === 'live.com')
            provider = 'Outlook';
        else if (domain === 'hotmail.com') provider = 'Hotmail';
        else if (domain === 'yahoo.com') provider = 'Yahoo';
        else if (domain === 'icloud.com' || domain === 'me.com') provider = 'iCloud';
        else if (domain === 'aol.com') provider = 'AOL';

        // Test IMAP connection
        const testResult = await ImapClientUtil.testConnection({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: email,
                pass: password,
            },
        }, configService);

        if (!testResult.success) {
            return {
                success: false,
                provider,
                error: this.formatErrorMessage(testResult.error || 'Unknown error'),
            };
        }

        return {
            success: true,
            provider,
        };
    }

    /**
     * Format error message for user-friendly display
     */
    private static formatErrorMessage(error: string): string {
        const lowerError = error.toLowerCase();

        if (
            lowerError.includes('authentication') ||
            lowerError.includes('invalid credentials') ||
            lowerError.includes('login')
        ) {
            return 'Authentication failed. Please check your email and app password. Make sure you are using an app-specific password, not your regular account password.';
        }

        if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
            return 'Connection timeout. Please check your internet connection and try again.';
        }

        if (lowerError.includes('enotfound') || lowerError.includes('dns')) {
            return 'Unable to connect to email server. Please check your internet connection.';
        }

        if (lowerError.includes('econnrefused')) {
            return 'Connection refused by server. Please try again later.';
        }

        return `Connection failed: ${error}`;
    }
}
