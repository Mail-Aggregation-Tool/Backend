import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
    constructor(private readonly configService: ConfigService) {
        super({
            clientID: configService.get<string>('MICROSOFT_CLIENT_ID') || 'process.env.MICROSOFT_CLIENT_ID',
            clientSecret: configService.get<string>('MICROSOFT_CLIENT_SECRET') || 'process.env.MICROSOFT_CLIENT_SECRET',
            callbackURL: `${configService.get<string>('API_URL')}/auth/microsoft/callback`,
            scope: ['user.read', 'email', 'openid', 'profile'],
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
