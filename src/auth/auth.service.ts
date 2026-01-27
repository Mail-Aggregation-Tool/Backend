import { Injectable, UnauthorizedException, ConflictException, Inject, forwardRef, NotFoundException, BadRequestException } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { AuthRepository } from './auth.repository';
import { AuthUtils } from './auth.utils';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { EmailAccountsService } from '../email-accounts/email-accounts.service';

@Injectable()
export class AuthService {
    constructor(
        private authRepository: AuthRepository,
        private jwtService: JwtService,
        @Inject(forwardRef(() => EmailAccountsService))
        private emailAccountsService: EmailAccountsService,
    ) { }

    private generateToken(userId: string, email: string): string {
        return this.jwtService.sign({ id: userId, email });
    }

    async signup(signupDto: SignupDto) {
        const { name, email, password } = signupDto;

        const userExists = await this.authRepository.findUserByEmail(email);
        if (userExists) {
            throw new ConflictException('User already exists');
        }

        const hashedPassword = await AuthUtils.hashPassword(password);

        const user = await this.authRepository.createUser({
            email,
            name,
            password: hashedPassword,
        });

        return {
            user: AuthUtils.sanitizeUser(user),
            message: 'User registered successfully!',
        };
    }

    async login(loginDto: LoginDto) {
        const { email, password } = loginDto;

        const user = await this.authRepository.findUserByEmail(email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.password) {
            throw new UnauthorizedException('Please login with your OAuth provider');
        }

        const passwordValid = await AuthUtils.verifyPassword(user.password, password);
        if (!passwordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const token = this.generateToken(user.id, user.email);

        return {
            user: AuthUtils.sanitizeUser(user),
            token,
        };
    }

    async microsoftAuth(oauthUser: any) {
        const { email, name, oauthId, accessToken, refreshToken } = oauthUser;

        let user = await this.authRepository.findUserByEmail(email);

        if (user) {
            // Update OAuth info if missing
            if (!user.oauthId) {
                user = await this.authRepository.update(user.id, {
                    oauthId,
                    oauthProvider: 'microsoft',
                });
            }
        } else {
            // Create new OAuth user
            user = await this.authRepository.createUser({
                email,
                name,
                oauthId,
                oauthProvider: 'microsoft',
                password: null, // No password for OAuth users
            });
        }

        const token = this.generateToken(user.id, user.email);

        return {
            user: AuthUtils.sanitizeUser(user),
            token,
        };
    }

    async connectOutlook(oauthUser: any) {
        const { email, name, oauthId, accessToken, refreshToken } = oauthUser;

        if (!email) {
            throw new BadRequestException('Email not provided by OAuth provider');
        }

        let user = await this.authRepository.findUserByEmail(email);
        if (!user) {
            // User must exist to connect an email account
            throw new NotFoundException('You cannot connect an email account to a user that doesn\'t exist');
        } else {
            // Update OAuth ID if not present
            if (!user.oauthId && oauthId) {
                user = await this.authRepository.update(user.id, {
                    oauthId,
                    oauthProvider: 'microsoft',
                });
            }
        }

        // Link the email account (creates or updates, and triggers initial sync)
        await this.emailAccountsService.createWithOAuth(
            user.id,
            email,
            accessToken,
            refreshToken
        );

        // Generate JWT token for user login
        const token = this.generateToken(user.id, user.email);
        return token;
    }
}
