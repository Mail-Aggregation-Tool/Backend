import { Client } from '@microsoft/microsoft-graph-client';
import { Logger } from '@nestjs/common';
import 'isomorphic-fetch'; // Ensure fetch is available

export interface GraphFolderInfo {
    id: string;
    displayName: string;
    parentFolderId?: string;
    childFolderCount: number;
    unreadItemCount: number;
    totalItemCount: number;
    wellKnownName?: string;
}

export interface GraphMessage {
    id: string;
    receivedDateTime: string;
    hasAttachments: boolean;
    internetMessageId: string;
    subject: string;
    bodyPreview: string;
    importance: string;
    parentFolderId: string;
    conversationId: string;
    isRead: boolean;
    body: {
        contentType: string;
        content: string;
    };
    from: {
        emailAddress: {
            name: string;
            address: string;
        };
    };
    toRecipients: Array<{
        emailAddress: {
            name: string;
            address: string;
        };
    }>;
    ccRecipients: Array<{
        emailAddress: {
            name: string;
            address: string;
        };
    }>;
    bccRecipients: Array<{
        emailAddress: {
            name: string;
            address: string;
        };
    }>;
    replyTo: Array<{
        emailAddress: {
            name: string;
            address: string;
        };
    }>;
    flag: {
        flagStatus: string;
    };
}

export class GraphClientUtil {
    private client: Client;
    private readonly logger = new Logger(GraphClientUtil.name);

    constructor(accessToken: string) {
        this.client = Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            },
        });
    }

    /**
     * List all mail folders
     */
    async listFolders(): Promise<GraphFolderInfo[]> {
        try {
            const folders: GraphFolderInfo[] = [];
            let url = '/me/mailFolders?$top=100'; // Max page size

            while (url) {
                const response = await this.client.api(url).get();

                if (response.value && Array.isArray(response.value)) {
                    folders.push(...response.value);
                }

                url = response['@odata.nextLink'];
            }

            return folders;
        } catch (error) {
            this.logger.error(`Failed to list folders: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetch messages from a specific folder
     * @param folderId - The ID of the folder to fetch from
     * @param limit - Max number of messages to fetch
     * @param skip - Number of messages to skip (for pagination)
     * @returns Array of messages
     */
    async fetchMessages(folderId: string, limit: number = 50, skip: number = 0): Promise<GraphMessage[]> {
        try {
            const response = await this.client
                .api(`/me/mailFolders/${folderId}/messages`)
                .top(limit)
                .skip(skip)
                .select('id,receivedDateTime,hasAttachments,internetMessageId,subject,bodyPreview,importance,parentFolderId,conversationId,isRead,body,from,toRecipients,ccRecipients,bccRecipients,replyTo,flag')
                .orderby('receivedDateTime desc')
                .get();

            return response.value || [];
        } catch (error) {
            this.logger.error(`Failed to fetch messages for folder ${folderId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetch messages updated after a certain time (for incremental sync)
     * @param folderId - The ID of the folder
     * @param lastModifiedDateTime - Fetch messages received/modified after this date
     */
    async fetchNewMessages(folderId: string, lastModifiedDateTime: Date): Promise<GraphMessage[]> {
        try {
            // Format date to ISO string
            const dateStr = lastModifiedDateTime.toISOString();

            const messages: GraphMessage[] = [];
            // We'll fetch pages until we find no more or hit a limit? 
            // For now, let's just fetch the top ones that match the filter.
            // Be careful with large delta, ideally usage of Delta Query is better but this is "incremental sync" mimicking IMAP behavior.

            let url = `/me/mailFolders/${folderId}/messages?$filter=receivedDateTime ge ${dateStr}&$orderby=receivedDateTime desc&$top=50`;

            while (url) {
                const response = await this.client.api(url).get();

                if (response.value && Array.isArray(response.value)) {
                    messages.push(...response.value);
                }

                // If we have a lot, maybe stop? For now follow pages.
                url = response['@odata.nextLink'];

                // Safety break if too many?
                if (messages.length > 500) break;
            }

            return messages;
        } catch (error) {
            this.logger.error(`Failed to fetch new messages for folder ${folderId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a single message by ID
     */
    async getMessage(messageId: string): Promise<GraphMessage> {
        try {
            return await this.client.api(`/me/messages/${messageId}`).get();
        } catch (error) {
            this.logger.error(`Failed to get message ${messageId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get attachments for a message
     */
    async getAttachments(messageId: string): Promise<any[]> {
        try {
            const response = await this.client.api(`/me/messages/${messageId}/attachments`).get();
            return response.value || [];
        } catch (error) {
            this.logger.error(`Failed to get attachments for message ${messageId}: ${error.message}`);
            throw error;
        }
    }
}
