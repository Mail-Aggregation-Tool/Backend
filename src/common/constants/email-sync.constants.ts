/**
 * Email sync constants for BullMQ jobs and IMAP operations
 */

// Queue names
export const QUEUE_NAMES = {
    INITIAL_SYNC: 'initial-sync',
    INCREMENTAL_SYNC: 'incremental-sync',
    ATTACHMENT_UPLOAD: 'attachment-upload',
} as const;

// Job types
export const JOB_TYPES = {
    SYNC_ACCOUNT: 'sync-account',
    SYNC_FOLDER: 'sync-folder',
    UPLOAD_ATTACHMENT: 'upload-attachment',
} as const;

// Sync settings
export const SYNC_SETTINGS = {
    CHUNK_SIZE: 50, // Number of emails to process in one batch
    INITIAL_SYNC_CHUNK_SIZE: 100, // Larger chunks for initial sync
    MAX_RETRIES: 3,
    BACKOFF_DELAY: 5000, // 5 seconds
    SYNC_INTERVAL_MS: 300000, // 5 minutes
} as const;

// IMAP settings
export const IMAP_SETTINGS = {
    TIMEOUT: 30000, // 30 seconds
    RECONNECT_DELAY: 5000, // 5 seconds
    MAX_RECONNECT_ATTEMPTS: 3,
} as const;

// Worker settings
export const WORKER_SETTINGS = {
    MEMORY_LIMIT_MB: 512,
    CONCURRENCY: 2, // Number of concurrent jobs per worker
} as const;

// Standard folder names (normalized)
export const STANDARD_FOLDERS = {
    INBOX: 'INBOX',
    SENT: 'Sent',
    DRAFTS: 'Drafts',
    TRASH: 'Trash',
    SPAM: 'Spam',
    ARCHIVE: 'Archive',
} as const;

// Folder name mappings for different providers
export const FOLDER_MAPPINGS: Record<string, Record<string, string>> = {
    gmail: {
        '[Gmail]/Sent Mail': STANDARD_FOLDERS.SENT,
        '[Gmail]/Drafts': STANDARD_FOLDERS.DRAFTS,
        '[Gmail]/Trash': STANDARD_FOLDERS.TRASH,
        '[Gmail]/Spam': STANDARD_FOLDERS.SPAM,
        '[Gmail]/All Mail': STANDARD_FOLDERS.ARCHIVE,
    },
    outlook: {
        'Sent Items': STANDARD_FOLDERS.SENT,
        'Deleted Items': STANDARD_FOLDERS.TRASH,
        'Junk Email': STANDARD_FOLDERS.SPAM,
    },
    yahoo: {
        'Sent': STANDARD_FOLDERS.SENT,
        'Draft': STANDARD_FOLDERS.DRAFTS,
        'Trash': STANDARD_FOLDERS.TRASH,
        'Bulk Mail': STANDARD_FOLDERS.SPAM,
    },
};
