import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '../auth.service';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
export class MicrosoftOutlookStrategy extends PassportStrategy(Strategy, 'microsoft-outlook') {
    constructor(
        private readonly configService: ConfigService,
        private readonly authService: AuthService,
    ) {
        super({
            clientID: configService.get<string>('MICROSOFT_CLIENT_ID') || 'process.env.MICROSOFT_CLIENT_ID',
            clientSecret: configService.get<string>('MICROSOFT_CLIENT_SECRET') || 'process.env.MICROSOFT_CLIENT_SECRET',
            callbackURL: `${configService.get<string>('API_URL')}/auth/microsoft/outlook/callback`,
            scope: [
                'profile',
                'user.read',
                'openid',
                'email',
                'offline_access',
                'Mail.Read',
            ],
            passReqToCallback: true,
        });
    }

    async validate(req: any, accessToken: string, refreshToken: string, profile: any, done: Function) {
        const state = req.query?.state;
        let userId: string | null = null;

        if (state) {
            try {
                // Verify state and retrieve user ID - this also consumes the state token (single use)
                userId = await this.authService.verifyOutlookState(state);
            } catch (error) {
                // State is invalid or expired
                return done(new UnauthorizedException('Invalid, expired, or used state parameter'), null);
            }
        }

        const user = {
            accessToken,
            refreshToken,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            oauthId: profile.id,
            stateUserId: userId, // Pass the verified user ID (if any)
        };
        done(null, user);
    }
}
