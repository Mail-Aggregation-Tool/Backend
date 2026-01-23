import * as argon2 from 'argon2';
import { User } from '@prisma/client';

export class AuthUtils {
    static async hashPassword(password: string): Promise<string> {
        return argon2.hash(password);
    }

    static async verifyPassword(hashedPassword: string, plainPassword: string): Promise<boolean> {
        try {
            return await argon2.verify(hashedPassword, plainPassword);
        } catch (error) {
            return false;
        }
    }

    static sanitizeUser(user: User): Partial<User> {
        const { password, ...sanitized } = user;
        return sanitized;
    }

    static generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    static generateOtpExpiry(): Date {
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10); // 10 minutes from now
        return expiry;
    }

}
