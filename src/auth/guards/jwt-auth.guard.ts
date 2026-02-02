import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    let token: string | undefined;

    // 1️⃣ Try Authorization header first (normal case)
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2️⃣ DEV ONLY: fallback to query param
    if (!token && this.configService.get('NODE_ENV') === 'development') {
      token = request.query?.token;
    }

    if (!token) {
      throw new UnauthorizedException('Unauthorized: No token provided');
    }

    try {
      const secretKey = this.configService.get<string>('JWT_SECRET');

      const decodedToken = await this.jwtService.verifyAsync(token, {
        secret: secretKey,
      });

      // Attach user info to request
      request.user = {
        id: decodedToken.id,
        email: decodedToken.email,
      };

      return true;
    } catch (error) {
      console.error('JWT Verification Error:', error);
      throw new UnauthorizedException('Unauthorized: Invalid or expired token');
    }
  }
}
