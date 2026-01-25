import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MicrosoftOutlookStrategy extends PassportStrategy(Strategy, 'microsoft-outlook') {
    constructor(private readonly configService: ConfigService) {
        super({
            clientID: configService.get<string>('MICROSOFT_CLIENT_ID') || 'process.env.MICROSOFT_CLIENT_ID',
            clientSecret: configService.get<string>('MICROSOFT_CLIENT_SECRET') || 'process.env.MICROSOFT_CLIENT_SECRET',
            callbackURL: `${configService.get<string>('API_URL')}/auth/microsoft/outlook/callback`,
            scope: [
                'openid',
                'profile',
                'email',
                'offline_access',
                'https://outlook.office.com/IMAP.AccessAsUser.All',
                'https://outlook.office.com/SMTP.Send',
            ],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: Function) {
        const user = {
            accessToken,
            refreshToken,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            oauthId: profile.id,
        };
        done(null, user);
    }
}
