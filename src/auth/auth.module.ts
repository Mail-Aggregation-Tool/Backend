import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';
import { MicrosoftOutlookStrategy } from './strategies/microsoft-outlook.strategy';
import { EmailAccountsModule } from '../email-accounts/email-accounts.module';

@Module({
    imports: [
        PrismaModule,
        PassportModule,
        ConfigModule,
        forwardRef(() => EmailAccountsModule),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'super-secret-key-change-in-prod',
            signOptions: { expiresIn: (process.env.JWT_EXPIRATION_TIME || '1d') as any }
        })
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        AuthRepository,
        JwtAuthGuard,
        MicrosoftStrategy,
        MicrosoftOutlookStrategy
    ],
    exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule { }
