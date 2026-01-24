import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Utility for encrypting and decrypting sensitive data like app passwords
 * Uses AES-256-GCM for authenticated encryption
 */
export class EncryptionUtil {
    private static readonly ALGORITHM = 'aes-256-gcm';
    private static readonly KEY_LENGTH = 32; // 256 bits
    private static readonly IV_LENGTH = 16; // 128 bits
    private static readonly SALT_LENGTH = 16;
    private static readonly TAG_LENGTH = 16;

    /**
     * Derive a key from the encryption secret
     */
    private static deriveKey(secret: string, salt: Buffer): Buffer {
        return scryptSync(secret, salt, EncryptionUtil.KEY_LENGTH);
    }

    /**
     * Encrypt a plaintext string
     * @param plaintext - The text to encrypt
     * @param secret - The encryption secret (from environment variable)
     * @returns Encrypted string in format: salt:iv:authTag:encryptedData (all base64)
     */
    static encrypt(plaintext: string, secret: string): string {
        if (!secret || secret.length < 32) {
            throw new Error('Encryption secret must be at least 32 characters long');
        }

        // Generate random salt and IV
        const salt = randomBytes(EncryptionUtil.SALT_LENGTH);
        const iv = randomBytes(EncryptionUtil.IV_LENGTH);

        // Derive key from secret
        const key = EncryptionUtil.deriveKey(secret, salt);

        // Create cipher
        const cipher = createCipheriv(EncryptionUtil.ALGORITHM, key, iv);

        // Encrypt
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        // Get auth tag
        const authTag = cipher.getAuthTag();

        // Combine salt, iv, authTag, and encrypted data
        return [
            salt.toString('base64'),
            iv.toString('base64'),
            authTag.toString('base64'),
            encrypted,
        ].join(':');
    }

    /**
     * Decrypt an encrypted string
     * @param encryptedData - The encrypted string (format: salt:iv:authTag:encryptedData)
     * @param secret - The encryption secret (from environment variable)
     * @returns Decrypted plaintext string
     */
    static decrypt(encryptedData: string, secret: string): string {
        if (!secret || secret.length < 32) {
            throw new Error('Encryption secret must be at least 32 characters long');
        }

        // Split the encrypted data
        const parts = encryptedData.split(':');
        if (parts.length !== 4) {
            throw new Error('Invalid encrypted data format');
        }

        const [saltB64, ivB64, authTagB64, encrypted] = parts;

        // Convert from base64
        const salt = Buffer.from(saltB64, 'base64');
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');

        // Derive key from secret
        const key = EncryptionUtil.deriveKey(secret, salt);

        // Create decipher
        const decipher = createDecipheriv(EncryptionUtil.ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        // Decrypt
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Generate a random encryption key (for initial setup)
     * @returns A random 64-character hex string suitable for use as ENCRYPTION_KEY
     */
    static generateKey(): string {
        return randomBytes(32).toString('hex');
    }
}
