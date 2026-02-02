import {
    STANDARD_FOLDERS,
    FOLDER_MAPPINGS,
} from '../../common/constants/email-sync.constants';

export class FolderNormalizerUtil {
    /**
     * Normalize folder name based on provider
     * @param folderPath - Raw folder path from IMAP
     * @param provider - Email provider (gmail, outlook, etc.)
     * @returns Normalized folder name
     */
    static normalizeFolderName(
        folderPath: string,
        provider: string | null,
        specialUse?: string,
        flags?: Set<string>,
    ): string {
        // If INBOX, always return as-is (standard across all providers)
        if (folderPath.toUpperCase() === 'INBOX') {
            return STANDARD_FOLDERS.INBOX;
        }

        // Check specialUse attribute first (RFC 6154)
        if (specialUse) {
            const use = specialUse.replace(/^\\/, '').toLowerCase();
            switch (use) {
                case 'inbox': return STANDARD_FOLDERS.INBOX;
                case 'sent': return STANDARD_FOLDERS.SENT;
                case 'drafts': return STANDARD_FOLDERS.DRAFTS;
                case 'trash': return STANDARD_FOLDERS.TRASH;
                case 'junk':
                case 'spam': return STANDARD_FOLDERS.SPAM;
                case 'archive': return STANDARD_FOLDERS.ARCHIVE;
            }
        }

        // Graph returns names like 'inbox', 'sentitems', 'deleteditems', 'junkemail', 'archive'
        const nameLower = folderPath.toLowerCase();
        if (nameLower === 'inbox') return STANDARD_FOLDERS.INBOX;
        if (nameLower === 'sentitems' || nameLower === 'sent items') return STANDARD_FOLDERS.SENT;
        if (nameLower === 'deleteditems' || nameLower === 'deleted items') return STANDARD_FOLDERS.TRASH;
        if (nameLower === 'junkemail' || nameLower === 'junk email') return STANDARD_FOLDERS.SPAM;
        if (nameLower === 'archive') return STANDARD_FOLDERS.ARCHIVE;
        if (nameLower === 'drafts') return STANDARD_FOLDERS.DRAFTS;
        if (nameLower === 'conversation history') return 'Conversation History';
        if (nameLower === 'outbox') return 'Outbox';

        // Check flags if specialUse not available
        if (flags) {
            if (flags.has('\\Sent') || flags.has('\\SentMail')) return STANDARD_FOLDERS.SENT;
            if (flags.has('\\Drafts')) return STANDARD_FOLDERS.DRAFTS;
            if (flags.has('\\Trash')) return STANDARD_FOLDERS.TRASH;
            if (flags.has('\\Junk') || flags.has('\\Spam')) return STANDARD_FOLDERS.SPAM;
            if (flags.has('\\Archive')) return STANDARD_FOLDERS.ARCHIVE;
            if (flags.has('\\Flagged') || flags.has('\\Starred')) return STANDARD_FOLDERS.STARRED;
        }

        // Check provider-specific mappings
        if (provider && FOLDER_MAPPINGS[provider.toLowerCase()]) {
            const mapping = FOLDER_MAPPINGS[provider.toLowerCase()];
            if (mapping[folderPath]) {
                return mapping[folderPath];
            }
        }

        // Check for common patterns across providers
        const lowerPath = folderPath.toLowerCase();

        if (lowerPath.includes('sent')) {
            return STANDARD_FOLDERS.SENT;
        }

        if (lowerPath.includes('draft')) {
            return STANDARD_FOLDERS.DRAFTS;
        }

        if (
            lowerPath.includes('trash') ||
            lowerPath.includes('deleted') ||
            lowerPath.includes('bin')
        ) {
            return STANDARD_FOLDERS.TRASH;
        }

        if (lowerPath.includes('spam') || lowerPath.includes('junk')) {
            return STANDARD_FOLDERS.SPAM;
        }

        if (
            lowerPath.includes('archive') ||
            lowerPath.includes('all mail')
        ) {
            return STANDARD_FOLDERS.ARCHIVE;
        }

        if (lowerPath.includes('important')) {
            return STANDARD_FOLDERS.IMPORTANT;
        }

        if (lowerPath.includes('starred') || lowerPath.includes('flagged')) {
            return STANDARD_FOLDERS.STARRED;
        }

        // Return original if no mapping found
        return folderPath;
    }

    /**
     * Check if folder should be synced
     * @param folderPath - Folder path
     * @returns True if folder should be synced
     */
    static shouldSyncFolder(folderPath: string): boolean {
        const lowerPath = folderPath.toLowerCase();

        // Skip system folders
        const skipPatterns = [
            '[gmail]/all mail', // Skip "All Mail" to avoid duplicates
            'notes',
            'contacts',
            'calendar',
            'tasks',
            'journal',
            'sync issues',
            'local failures',
            'server failures',
            'yammer root'
        ];

        return !skipPatterns.some((pattern) => lowerPath.includes(pattern));
    }

    /**
     * Get folder priority for sync order
     * Higher priority folders are synced first
     * @param folderPath - Folder path
     * @returns Priority number (higher = more important)
     */
    static getFolderPriority(folderPath: string): number {
        const normalized = folderPath.toUpperCase();

        if (normalized === 'INBOX') return 100;
        if (normalized.includes('SENT')) return 90;
        if (normalized.includes('DRAFT')) return 80;
        if (normalized.includes('IMPORTANT')) return 75;
        if (normalized.includes('ARCHIVE')) return 70;
        if (normalized.includes('SPAM') || normalized.includes('JUNK')) return 50;
        if (normalized.includes('TRASH') || normalized.includes('DELETED'))
            return 40;

        return 60; // Default priority for custom folders
    }

    /**
     * Sort folders by priority
     * @param folders - Array of folder paths
     * @returns Sorted array with highest priority first
     */
    static sortFoldersByPriority(folders: string[]): string[] {
        return folders.sort(
            (a, b) => this.getFolderPriority(b) - this.getFolderPriority(a),
        );
    }
}
