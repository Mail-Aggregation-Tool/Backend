import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class AuthRepository {
    constructor(private prisma: PrismaService) { }

    async findUserByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async createUser(data: Prisma.UserCreateInput): Promise<User> {
        return this.prisma.user.create({
            data,
        });
    }

    async findUserById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }
    async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async createRefreshToken(data: any): Promise<any> {
        return this.prisma.refreshToken.create({
            data,
        });
    }

    async findRefreshTokenById(id: string): Promise<any> {
        return this.prisma.refreshToken.findUnique({
            where: { id },
            include: { user: true },
        });
    }

    async revokeRefreshToken(id: string): Promise<any> {
        return this.prisma.refreshToken.update({
            where: { id },
            data: { isRevoked: true },
        });
    }

    async rotateRefreshToken(oldTokenId: string, newTokenId: string): Promise<any> {
        return this.prisma.$transaction([
            this.prisma.refreshToken.update({
                where: { id: oldTokenId },
                data: {
                    isRevoked: true,
                    replacedBy: newTokenId
                },
            }),
        ]);
    }
}
