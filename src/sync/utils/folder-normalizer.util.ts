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
    ): string {
        // If INBOX, always return as-is (standard across all providers)
        if (folderPath.toUpperCase() === 'INBOX') {
            return STANDARD_FOLDERS.INBOX;
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
