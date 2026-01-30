import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OAuthTokenUtil {
    private readonly logger = new Logger(OAuthTokenUtil.name);

    constructor(private configService: ConfigService) { }

    /**
     * Refresh Microsoft OAuth 2.0 token
     * @param refreshToken - The current refresh token
     * @returns New access token and refresh token
     */
    async refreshMicrosoftToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        try {
            const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID');
            const clientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET');
            const tenantId = 'common'; // Or specific tenant if needed

            if (!clientId || !clientSecret) {
                throw new Error('Microsoft OAuth credentials not configured');
            }

            const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

            const params = new URLSearchParams();
            params.append('client_id', clientId);
            params.append('client_secret', clientSecret);
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', refreshToken);
            // Scope should be the same as initially requested or a subset
            params.append('scope', 'user.read email offline_access IMAP.AccessAsUser.All');

            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`Failed to refresh Microsoft token: ${response.status} ${response.statusText} - ${errorText}`);
                throw new Error(`Token refresh failed: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.access_token || !data.refresh_token) {
                throw new Error('Invalid response from token endpoint');
            }

            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
            };
        } catch (error) {
            this.logger.error(`Error refreshing Microsoft token: ${error.message}`);
            throw new InternalServerErrorException(`Failed to refresh OAuth token: ${error.message}`);
        }
    }
}
