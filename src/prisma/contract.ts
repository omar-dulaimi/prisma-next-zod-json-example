import { defineContract } from '@prisma-next/postgres/contract-builder';
import { zodJson } from 'prisma-next-zod-json/column-types';
import zodJsonPack from 'prisma-next-zod-json/pack';
import { TenantSettings, WebhookPayload } from './schemas.ts';

export const contract = defineContract(
  {},
  ({ field, model }) => ({
    // The contract plane. Note this belongs in the object the callback returns, beside `models`,
    // `defineConfig` accepts an `extensionPacks` key and quietly ignores it.
    extensionPacks: {
      zodJson: zodJsonPack,
    },
    models: {
      Tenant: model('Tenant', {
        fields: {
          id: field.id.uuidv7String(),
          slug: field.text().unique(),
          settings: field.column(zodJson(TenantSettings)),
        },
      }),

      WebhookEvent: model('WebhookEvent', {
        fields: {
          id: field.id.uuidv7String(),
          tenantSlug: field.text(),
          receivedAt: field.temporal.createdAt(),
          payload: field.column(zodJson(WebhookPayload)),
        },
      }),
    },
  }),
);
