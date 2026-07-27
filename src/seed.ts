import { client, db } from './db.js';

/** A couple of tenants and a spread of event kinds, so the API has something to return. */

const tenants = [
  {
    slug: 'acme',
    settings: {
      displayName: 'Acme Ltd',
      locale: 'en-GB',
      notifications: { email: true, webhookUrl: 'https://acme.example/hooks', digestHour: 9 },
      retryPolicy: { maxAttempts: 3, backoff: 'exponential' as const },
      tags: ['billing', 'priority'],
    },
  },
  {
    slug: 'globex',
    settings: {
      displayName: 'Globex',
      locale: 'de-DE',
      notifications: { email: false },
      retryPolicy: { maxAttempts: 1, backoff: 'fixed' as const },
      tags: [],
    },
  },
];

const events = [
  ['acme', { kind: 'payment.succeeded', amountCents: 4999, currency: 'gbp', reference: 'inv-1041' }],
  ['acme', { kind: 'payment.refunded', amountCents: 4999, currency: 'gbp', reason: 'requested_by_customer' }],
  ['acme', { kind: 'user.created', email: 'ada@acme.example', plan: 'enterprise' }],
  ['globex', { kind: 'user.created', email: 'hank@globex.example', plan: 'free' }],
] as const;

for (const tenant of tenants) {
  await db.Tenant.create(tenant);
  console.log(`tenant  ${tenant.slug}`);
}

for (const [tenantSlug, payload] of events) {
  await db.WebhookEvent.create({ tenantSlug, payload });
  console.log(`event   ${tenantSlug} ${payload.kind}`);
}

console.log(`\nSeeded ${tenants.length} tenants and ${events.length} events.`);
await client.close();
