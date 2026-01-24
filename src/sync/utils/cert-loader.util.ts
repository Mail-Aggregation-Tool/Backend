import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '@nestjs/common';

/**
 * Utility class for loading SSL/TLS certificates for IMAP connections
 * Dynamically loads all .crt files from a configured directory
 */
export class CertificateLoader {
    private static readonly logger = new Logger(CertificateLoader.name);
    private static cachedCertificates: Buffer[] | null = null;

    /**
     * Load all SSL certificates from the configured directory
     * @param certsPath - Path to the directory containing .crt files (default: ./certs)
     * @returns Array of certificate buffers
     */
    static async loadCertificates(
        certsPath: string = process.env.IMAP_CERTS_PATH || './certs',
    ): Promise<Buffer[]> {
        // Return cached certificates if available
        if (this.cachedCertificates !== null) {
            this.logger.debug(
                `Using cached certificates (${this.cachedCertificates.length} loaded)`,
            );
            return this.cachedCertificates;
        }

        const certificates: Buffer[] = [];
        const absolutePath = path.resolve(process.cwd(), certsPath);

        try {
            // Check if directory exists
            try {
                await fs.access(absolutePath);
            } catch (error) {
                this.logger.warn(
                    `Certificate directory not found: ${absolutePath}. IMAP connections may fail with self-signed certificate errors.`,
                );
                this.cachedCertificates = [];
                return [];
            }

            // Read directory contents
            const files = await fs.readdir(absolutePath);
            const certFiles = files.filter((file) => file.endsWith('.crt'));

            if (certFiles.length === 0) {
                this.logger.warn(
                    `No .crt files found in ${absolutePath}. IMAP connections may fail with self-signed certificate errors.`,
                );
                this.cachedCertificates = [];
                return [];
            }

            // Load each certificate file
            for (const certFile of certFiles) {
                const certPath = path.join(absolutePath, certFile);

                try {
                    const certContent = await fs.readFile(certPath);
                    certificates.push(certContent);
                    this.logger.debug(`Loaded certificate: ${certFile}`);
                } catch (error) {
                    this.logger.error(
                        `Failed to load certificate ${certFile}: ${error.message}`,
                    );
                    // Continue loading other certificates even if one fails
                }
            }

            // Cache the loaded certificates
            this.cachedCertificates = certificates;

            this.logger.log(
                `Successfully loaded ${certificates.length} SSL certificate(s) from ${absolutePath}`,
            );

            return certificates;
        } catch (error) {
            this.logger.error(
                `Error loading certificates from ${absolutePath}: ${error.message}`,
            );
            this.cachedCertificates = [];
            return [];
        }
    }

    /**
     * Clear the certificate cache
     * Useful for testing or when certificates are updated at runtime
     */
    static clearCache(): void {
        this.cachedCertificates = null;
        this.logger.debug('Certificate cache cleared');
    }

    /**
     * Get the number of cached certificates
     * @returns Number of cached certificates, or null if not cached
     */
    static getCachedCount(): number | null {
        return this.cachedCertificates?.length ?? null;
    }
}
