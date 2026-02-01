import { Injectable, UnauthorizedException, ConflictException, Inject, forwardRef, NotFoundException, BadRequestException } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { AuthRepository } from './auth.repository';
import { AuthUtils } from './auth.utils';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { EmailAccountsService } from '../email-accounts/email-accounts.service'; // Adjust path if needed
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
    constructor(
        private authRepository: AuthRepository,
        private jwtService: JwtService,
        @Inject(forwardRef(() => EmailAccountsService))
        private emailAccountsService: EmailAccountsService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    private generateToken(userId: string, email: string): string {
        return this.jwtService.sign({ id: userId, email });
    }

    async generateOutlookState(userId: string): Promise<string> {
        const state = uuidv4();
        // Store in cache for 10 minutes (600000 ms)
        await this.cacheManager.set(`outlook_state:${state}`, userId, 600000);
        return state;
    }

    async verifyOutlookState(state: string): Promise<string> {
        const key = `outlook_state:${state}`;
        const userId = await this.cacheManager.get<string>(key);

        if (!userId) {
            throw new UnauthorizedException('Invalid or expired state parameter');
        }

        // State should be single-use
        await this.cacheManager.del(key);
        return userId;
    }

    async generateRefreshToken(userId: string): Promise<string> {
        // Generate a random token secret
        const refreshTokenSecret = AuthUtils.generateRandomToken(); // Need to add this util
        const tokenId = AuthUtils.generateUuid(); // Need to add this util

        // Hash the secret
        const tokenHash = await AuthUtils.hashPassword(refreshTokenSecret);

        // Store in DB
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30); // 30 days expiry

        await this.authRepository.createRefreshToken({
            id: tokenId,
            userId,
            tokenHash,
            expiresAt: expirationDate
        });

        // Return the combined token
        return `${tokenId}:${refreshTokenSecret}`;
    }

    async rotateRefreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string; user: any }> {
        const [tokenId, tokenSecret] = refreshToken.split(':');

        if (!tokenId || !tokenSecret) {
            throw new UnauthorizedException('Invalid refresh token format');
        }

        const storedToken = await this.authRepository.findRefreshTokenById(tokenId);

        if (!storedToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        // Check for reuse detection
        if (storedToken.isRevoked) {
            // REUSE DETECTED! Revoke the descendant token family if possible
            // For now, we just fail. Ideally, we would revoke the `replacedBy` token too.
            if (storedToken.replacedBy) {
                await this.authRepository.revokeRefreshToken(storedToken.replacedBy);
            }
            throw new UnauthorizedException('Refresh token reused - security alert');
        }

        // Verify hash
        const isValid = await AuthUtils.verifyPassword(storedToken.tokenHash, tokenSecret);
        if (!isValid) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        // Check expiration
        if (storedToken.expiresAt < new Date()) {
            throw new UnauthorizedException('Refresh token expired');
        }

        // Revoke the old token and rotate
        const user = storedToken.user;
        const newRefreshToken = await this.generateRefreshToken(user.id);
        const [newTokenId] = newRefreshToken.split(':');

        await this.authRepository.rotateRefreshToken(tokenId, newTokenId);

        const newAccessToken = this.generateToken(user.id, user.email);

        return {
            token: newAccessToken,
            refreshToken: newRefreshToken,
            user: AuthUtils.sanitizeUser(user)
        };
    }

    async getUserFromRefreshToken(refreshToken: string): Promise<any> {
        const [tokenId, tokenSecret] = refreshToken.split(':');

        if (!tokenId || !tokenSecret) {
            return null;
        }

        const storedToken = await this.authRepository.findRefreshTokenById(tokenId);

        if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
            return null;
        }

        const isValid = await AuthUtils.verifyPassword(storedToken.tokenHash, tokenSecret);
        if (!isValid) {
            return null;
        }

        return storedToken.user;
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
        const { email, name, oauthId, accessToken, refreshToken, stateUserId } = oauthUser;

        if (!email) {
            throw new BadRequestException('Email not provided by OAuth provider');
        }

        let user: any = null;

        // 1. Try to identify user by the state parameter (Authenticated session ID)
        if (stateUserId) {
            user = await this.authRepository.findUserById(stateUserId);
        }

        // 2. Fallback to email lookup if state is missing or user not found
        if (!user) {
            user = await this.authRepository.findUserByEmail(email);
        }

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
