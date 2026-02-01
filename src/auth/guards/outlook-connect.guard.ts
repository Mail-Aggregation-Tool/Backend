
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';

@Injectable()
export class OutlookConnectGuard extends AuthGuard('microsoft-outlook') {
    constructor(private authService: AuthService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        // 1. Ensure user is authenticated properly
        // Since JwtAuthGuard runs first, request.user should be populated.
        if (!request.user || !request.user.id) {
            throw new UnauthorizedException('User must be logged in to connect an account');
        }

        return super.canActivate(context) as Promise<boolean>;
    }

    async getAuthenticateOptions(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();

        // Generate the state parameter using AuthService
        if (request.user && request.user.id) {
            const state = await this.authService.generateOutlookState(request.user.id);
            return {
                state
            };
        }

        return {};
    }
}
