export interface ImapProviderConfig {
    host: string;
    port: number;
    secure: boolean;
}

export interface ProviderMapping {
    [key: string]: ImapProviderConfig;
}

export const IMAP_PROVIDERS: ProviderMapping = {
    gmail: {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
    },
    outlook: {
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
    },
    hotmail: {
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
    },
    yahoo: {
        host: 'imap.mail.yahoo.com',
        port: 993,
        secure: true,
    },
    icloud: {
        host: 'imap.mail.me.com',
        port: 993,
        secure: true,
    },
    aol: {
        host: 'imap.aol.com',
        port: 993,
        secure: true,
    },
};

/**
 * Detect IMAP provider from email address
 * @param email - User's email address
 * @returns Provider name (e.g., 'gmail', 'outlook') or null if unknown
 */
export function detectProvider(email: string): string | null {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return null;

    // Direct domain matches
    if (domain === 'gmail.com') return 'gmail';
    if (domain === 'outlook.com' || domain === 'live.com') return 'outlook';
    if (domain === 'hotmail.com') return 'hotmail';
    if (domain === 'yahoo.com') return 'yahoo';
    if (domain === 'icloud.com' || domain === 'me.com') return 'icloud';
    if (domain === 'aol.com') return 'aol';

    return null;
}

/**
 * Get IMAP configuration for a provider
 * @param provider - Provider name
 * @returns IMAP configuration or null if provider not found
 */
export function getProviderConfig(
    provider: string,
): ImapProviderConfig | null {
    return IMAP_PROVIDERS[provider.toLowerCase()] || null;
}

/**
 * Get IMAP configuration from email address
 * @param email - User's email address
 * @returns IMAP configuration or null if provider cannot be detected
 */
export function getConfigFromEmail(email: string): ImapProviderConfig | null {
    const provider = detectProvider(email);
    if (!provider) return null;
    return getProviderConfig(provider);
}
