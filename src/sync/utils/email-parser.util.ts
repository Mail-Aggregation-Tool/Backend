import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { Logger } from '@nestjs/common';

export interface ParsedEmailData {
    messageId: string | null;
    from: string;
    to: string[];
    subject: string;
    body: string;
    htmlBody: string | null;
    receivedAt: Date;
    flags: string[];
    attachments: ParsedAttachment[];
}

export interface ParsedAttachment {
    filename: string;
    contentType: string;
    size: number;
    contentId: string | null;
    content: Buffer;
}

export class EmailParserUtil {
    private static readonly logger = new Logger(EmailParserUtil.name);

    /**
     * Parse email from raw source buffer
     * @param source - Raw email source
     * @param flags - IMAP flags
     * @param uid - Email UID
     */
    static async parseEmail(
        source: Buffer,
        flags: Set<string>,
        uid: number,
    ): Promise<ParsedEmailData> {
        try {
            const parsed: ParsedMail = await simpleParser(source);

            // Extract from address
            const from = this.extractEmailAddress(parsed.from);

            // Extract to addresses
            const to = this.extractEmailAddresses(parsed.to);

            // Extract plain text body
            const body = parsed.text || '';

            // Extract HTML body
            const htmlBody = parsed.html ? String(parsed.html) : null;

            // Extract subject
            const subject = parsed.subject || '(No Subject)';

            // Extract message ID
            const messageId = parsed.messageId || null;

            // Extract received date
            const receivedAt = parsed.date || new Date();

            // Convert IMAP flags to array
            const flagsArray = Array.from(flags);

            // Parse attachments
            const attachments = this.parseAttachments(parsed.attachments || []);

            return {
                messageId,
                from,
                to,
                subject,
                body,
                htmlBody,
                receivedAt,
                flags: flagsArray,
                attachments,
            };
        } catch (error) {
            this.logger.error(`Failed to parse email UID ${uid}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract email address from address object
     */
    private static extractEmailAddress(
        addressObj: any,
    ): string {
        if (!addressObj) return '';

        if (typeof addressObj === 'string') return addressObj;

        if (addressObj.value && Array.isArray(addressObj.value)) {
            const firstAddress = addressObj.value[0];
            return firstAddress?.address || '';
        }

        if (addressObj.address) return addressObj.address;

        return '';
    }

    /**
     * Extract multiple email addresses
     */
    private static extractEmailAddresses(addressObj: any): string[] {
        if (!addressObj) return [];

        if (typeof addressObj === 'string') return [addressObj];

        if (addressObj.value && Array.isArray(addressObj.value)) {
            return addressObj.value
                .map((addr: any) => addr.address)
                .filter(Boolean);
        }

        if (Array.isArray(addressObj)) {
            return addressObj
                .map((addr: any) => addr.address || addr)
                .filter(Boolean);
        }

        if (addressObj.address) return [addressObj.address];

        return [];
    }

    /**
     * Parse attachments from parsed email
     */
    private static parseAttachments(
        attachments: Attachment[],
    ): ParsedAttachment[] {
        return attachments.map((attachment) => ({
            filename: attachment.filename || 'unnamed',
            contentType: attachment.contentType || 'application/octet-stream',
            size: attachment.size || 0,
            contentId: attachment.contentId || null,
            content: attachment.content,
        }));
    }

    /**
     * Check if email has attachments
     */
    static hasAttachments(parsed: ParsedEmailData): boolean {
        return parsed.attachments.length > 0;
    }

    /**
     * Get total attachments size
     */
    static getTotalAttachmentsSize(parsed: ParsedEmailData): number {
        return parsed.attachments.reduce((total, att) => total + att.size, 0);
    }
}
