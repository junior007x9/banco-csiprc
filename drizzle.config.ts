import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Carrega as senhas seguras do nosso arquivo .env.local
dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: './db/schema.ts', // <-- AQUI FOI A MUDANÇA (Avisando que db está na raiz)
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL as string,
    authToken: process.env.TURSO_AUTH_TOKEN as string,
  },
});