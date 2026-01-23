import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// This loads the variables from your .env file into process.env
dotenv.config();
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
  schema: "src/prisma/schema.prisma",
});