import 'dotenv/config';
import { defineConfig } from '@prisma-next/postgres/config';
import { zodJsonExtensionDescriptor } from 'prisma-next-zod-json/control';

export default defineConfig({
  contract: './src/prisma/contract.ts',
  // The control plane needs the codec to plan DDL for the jsonb columns.
  extensions: [zodJsonExtensionDescriptor],
  db: { connection: process.env['DATABASE_URL']! },
});
