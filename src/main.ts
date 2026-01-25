import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.enableCors({
    origin: [process.env.CLIENT_URL, 'http://localhost:3000'],
    methods: '*',
    allowedHeaders: '*',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Email Aggregator API')
    .setDescription(`
# Email Aggregator Backend API

A comprehensive email aggregation system for connecting multiple accounts, synchronizing emails, and performing advanced searches.

## Features
- 🔐 JWT authentication with Microsoft OAuth2 support
- 📧 Connect multiple email accounts via IMAP or OAuth
- 📨 Retrieve, filter, and organize emails
- 🔍 Full-text search using PostgreSQL FTS
- 📎 Cloud-based attachment storage (Cloudinary)
- 🔄 Background email synchronization

## Quick Start
1. Sign up: \`POST /auth/signup\`
2. Login: \`POST /auth/login\`
3. Connect email: \`POST /email-accounts\`
4. Emails sync automatically in the background
    `)
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication and OAuth endpoints')
    .addTag('Email Accounts', 'Manage connected email accounts')
    .addTag('Emails', 'Retrieve and manage emails from connected accounts')
    .addTag('Search', 'Full-text search and filtering capabilities')
    .addTag('Attachments', 'Email attachment management')
    .addTag('Application', 'Application health and status endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Email Aggregator API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 50px 0 }
      .swagger-ui .info .title { font-size: 36px }
    `,
  });

  console.log(`🚀 Server running on port ${process.env.PORT ?? 3000}`);
  console.log(`📚 Swagger documentation available at http://localhost:${process.env.PORT ?? 3000}/api`);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
