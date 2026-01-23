import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthRepository } from './auth.repository';
import { AuthUtils } from './auth.utils';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        private authRepository: AuthRepository,
        private jwtService: JwtService,
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
}
