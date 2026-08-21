import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import { zodJsonExtensionDescriptor } from 'prisma-next-zod-json/control';

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.ts',
    // The control plane needs the codec to plan DDL for the jsonb columns.
    extensions: [zodJsonExtensionDescriptor],
    db: { connection: process.env['DATABASE_URL']! },
  }),
});
