import { Logger } from '@nestjs/common';
import { GraphMessage } from './graph-client.util';

export interface ParsedGraphEmail {
    messageId: string;
    from: string;
    to: string[];
    subject: string;
    body: string;
    htmlBody: string;
    flags: string[];
    receivedAt: Date;
    hasAttachments: boolean;
}

export class GraphEmailParserUtil {
    private static readonly logger = new Logger(GraphEmailParserUtil.name);

    /**
     * Parse a Graph API message into our internal format
     */
    static parseEmail(message: GraphMessage): ParsedGraphEmail {
        try {
            // Extract From
            const from = message.from?.emailAddress?.address
                ? `${message.from.emailAddress.name || ''} <${message.from.emailAddress.address}>`.trim()
                : 'Unknown Sender';

            // Extract To
            const to = message.toRecipients?.map(
                (recipient) => recipient.emailAddress.address
            ) || [];

            // Extract Body (Graph gives both HTML and Text usually in body.content, 
            // but body.contentType tells us which one. 
            // Often we want plain text for search. 
            // If content type is HTML, we might need to strip tags for 'body' field
            // and keep 'htmlBody' as is.)

            const content = message.body?.content || '';
            const contentType = message.body?.contentType || 'text';

            let htmlBody = '';
            let textBody = '';

            if (contentType.toLowerCase() === 'html') {
                htmlBody = content;
                textBody = this.stripHtml(content); // Simple strip for search index
            } else {
                textBody = content;
                htmlBody = `<div>${content}</div>`; // Wrap plain text
            }

            // Preview is also useful for textBody if body is heavy HTML
            if (message.bodyPreview) {
                // Maybe prepend preview? Or just rely on stripped HTML
            }

            // Flags
            const flags: string[] = [];
            if (message.isRead) flags.push('\\Seen');
            if (message.flag?.flagStatus === 'flagged') flags.push('\\Flagged');

            return {
                messageId: message.internetMessageId || message.id, // Fallback to Graph ID if internet ID missing
                from,
                to,
                subject: message.subject || '(No Subject)',
                body: textBody,
                htmlBody: htmlBody,
                flags,
                receivedAt: new Date(message.receivedDateTime),
                hasAttachments: message.hasAttachments,
            };
        } catch (error) {
            this.logger.error(`Error parsing graph email ${message.id}: ${error.message}`);
            throw error;
        }
    }

    private static stripHtml(html: string): string {
        if (!html) return '';
        // Basic regex strip - rigorous stripping usually requires a DOM parser or library
        return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    }
}
