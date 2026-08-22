import { z } from 'zod';

/**
 * The zod schemas backing this app's JSON columns.
 *
 * These are ordinary zod schemas. They are the single definition of each column's shape: the database
 * enforces them on write, the emitted contract types read from them, and the HTTP layer needs no
 * separate validation of its own.
 *
 * Every constraint used here survives serialisation to JSON Schema and back.
 * `prisma-orm-extension-zod-json` refuses anything that would not, so if this file compiles and
 * `contract emit` succeeds, the rules below are the rules the database applies.
 */

/**
 * A webhook payload. Each event kind carries a different shape, which is exactly the case JSON columns
 * exist for: the alternative is a dozen mostly-null columns.
 *
 * A discriminated union round-trips intact, and renders in `contract.d.ts` as a real TypeScript union,
 * so narrowing on `kind` works downstream.
 */
export const WebhookPayload = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('payment.succeeded'),
    amountCents: z.number().int().positive(),
    currency: z.enum(['gbp', 'usd', 'eur']),
    reference: z.string().min(1).max(64),
  }),
  z.object({
    kind: z.literal('payment.refunded'),
    amountCents: z.number().int().positive(),
    currency: z.enum(['gbp', 'usd', 'eur']),
    reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']),
  }),
  z.object({
    kind: z.literal('user.created'),
    email: z.email(),
    plan: z.enum(['free', 'pro', 'enterprise']),
  }),
]);

/**
 * Per-tenant configuration. Nested, partly optional, and genuinely document-shaped.
 *
 * `strictObject` rather than `object`: zod's default strips unknown keys, and JSON Schema has no way to
 * express "strip", only allow or forbid. Being explicit means the column behaves identically whether
 * a value is checked in application code or by the database.
 */
export const TenantSettings = z.strictObject({
  displayName: z.string().min(1).max(80),
  locale: z.string().min(2).max(10),
  notifications: z.strictObject({
    email: z.boolean(),
    webhookUrl: z.url().optional(),
    digestHour: z.number().int().min(0).max(23).optional(),
  }),
  retryPolicy: z.strictObject({
    maxAttempts: z.number().int().min(1).max(10),
    backoff: z.enum(['fixed', 'exponential']),
  }),
  tags: z.array(z.string().min(1)).max(10),
});

export type WebhookPayload = z.infer<typeof WebhookPayload>;
export type TenantSettings = z.infer<typeof TenantSettings>;
