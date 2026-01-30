
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';

@Injectable()
export class MicrosoftOutlookOauthGuard extends AuthGuard('microsoft-outlook') {
    constructor(private authService: AuthService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        // 1. If JwtAuthGuard already ran and found a user, we are good.
        if (request.user && request.user.id) {
            return super.canActivate(context) as Promise<boolean>;
        }

        // 2. If not, try to recover user from refresh_token cookie
        // This handles browser-initiated requests (e.g. clicking "Connect" button) 
        // which contain cookies but not the Authorization header.
        const refreshToken = request.cookies?.['refresh_token'];
        if (refreshToken) {
            const user = await this.authService.getUserFromRefreshToken(refreshToken);
            if (user) {
                request.user = user;
                return super.canActivate(context) as Promise<boolean>;
            }
        }

        // 3. Fail if no user identified. Connect Account flow requires a user.
        throw new UnauthorizedException('User must be logged in to connect an account');
    }

    getAuthenticateOptions(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();

        // Prepare the 'state' parameter with the User ID
        if (request.user && request.user.id) {
            return {
                state: request.user.id
            };
        }

        return {};
    }
}
