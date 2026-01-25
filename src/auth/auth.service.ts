import { Injectable, UnauthorizedException, ConflictException, Inject, forwardRef, NotFoundException } from '@nestjs/common';

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
        const { email, accessToken, refreshToken } = oauthUser;

        const user = await this.authRepository.findUserByEmail(email);
        if (!user) {
            throw new NotFoundException('User not found. Please sign up first.');
        }

        // Link the email account
        const account = await this.emailAccountsService.createWithOAuth(
            user.id,
            email,
            accessToken,
            refreshToken
        );

        return account;
    }
}
