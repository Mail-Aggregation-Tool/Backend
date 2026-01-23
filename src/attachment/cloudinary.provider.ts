import { Provider, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const CloudinaryProvider: Provider = {
  provide: 'CLOUDINARY',
  useFactory: (configService: ConfigService) => {
    const logger = new Logger('CloudinaryProvider');
    const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME');

    const config = cloudinary.config({
      cloud_name: cloudName,
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });

    logger.log(`✅ Cloudinary connected successfully to cloud: ${cloudName}`);

    return config;
  },
  inject: [ConfigService],
};
