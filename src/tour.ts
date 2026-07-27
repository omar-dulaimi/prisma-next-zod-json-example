import { client, db } from './db.js';
import { zodJson } from 'prisma-next-zod-json/column-types';
import { z } from 'zod';

/**
 * A guided tour of what the codec does, run against the real database.
 *
 * Three things worth seeing: writes are validated before they land, the emitted types are real, and
 * schemas that JSON Schema would quietly break are refused while you are authoring them.
 */

const heading = (text: string) => console.log(`\n\x1b[1m${text}\x1b[0m\n${'─'.repeat(text.length)}`);
const ok = (text: string) => console.log(`  \x1b[32m✓\x1b[0m ${text}`);
const blocked = (text: string) => console.log(`  \x1b[33m⨯\x1b[0m ${text}`);

const suffix = Date.now().toString(36);
const slug = `acme-${suffix}`;

heading('1. A valid write lands');

await db.Tenant.create({
  slug,
  settings: {
    displayName: 'Acme Ltd',
    locale: 'en-GB',
    notifications: { email: true, digestHour: 9 },
    retryPolicy: { maxAttempts: 3, backoff: 'exponential' },
    tags: ['billing'],
  },
});
ok(`tenant ${slug} created`);

await db.WebhookEvent.create({
  tenantSlug: slug,
  payload: { kind: 'payment.succeeded', amountCents: 4999, currency: 'gbp', reference: 'inv-1' },
});
ok('payment.succeeded event stored');

heading('2. Invalid writes are rejected before they reach the table');

const rejections: [label: string, payload: unknown][] = [
  ['an unknown event kind', { kind: 'payment.exploded', amountCents: 1, currency: 'gbp' }],
  ['a negative amount', { kind: 'payment.succeeded', amountCents: -5, currency: 'gbp', reference: 'x' }],
  ['a non-integer amount', { kind: 'payment.succeeded', amountCents: 1.5, currency: 'gbp', reference: 'x' }],
  ['an unsupported currency', { kind: 'payment.succeeded', amountCents: 1, currency: 'yen', reference: 'x' }],
  ['a malformed email', { kind: 'user.created', email: 'not-an-email', plan: 'pro' }],
  ['a field belonging to a different branch', { kind: 'user.created', email: 'a@b.co', plan: 'pro', reason: 'duplicate' }],
];

for (const [label, payload] of rejections) {
  try {
    await db.WebhookEvent.create({ tenantSlug: slug, payload });
    console.log(`  \x1b[31m!\x1b[0m ${label} — ACCEPTED, which it should not have been`);
  } catch (error) {
    // "…failed (encode): <detail>" or "…failed (encode) at `field`: <detail>" when zod knows the path.
    const [, detail = ''] = /\(encode\)(?: at `[^`]*`)?: (.*)$/s.exec((error as Error).message) ?? [];
    blocked(`${label} — ${detail.split(';')[0]!.trim().slice(0, 76)}`);
  }
}

// Scoped to this run's tenant: the tour is re-runnable, so a global count would drift.
const stored = await db.WebhookEvent.where((m: Record<string, { eq(v: unknown): unknown }>) =>
  m['tenantSlug']!.eq(slug),
).all();
ok(`${stored.length} event for this tenant — none of the six rejections landed`);

heading('3. Reads come back typed and narrowable');

for (const event of stored) {
  const payload = event['payload'] as { kind: string; amountCents?: number; email?: string };
  // `contract.d.ts` types this as a real discriminated union, so `kind` narrows the rest.
  const detail = payload.kind.startsWith('payment') ? `${payload.amountCents} minor units` : payload.email;
  ok(`${payload.kind} → ${detail}`);
}

heading('4. Schemas that JSON Schema would silently break are refused');

const wouldBeSilentlyLost: [label: string, build: () => unknown][] = [
  ['a .refine() rule', () => zodJson(z.object({ slug: z.string().refine((s) => s === s.toLowerCase()) }))],
  ['a .trim() normaliser', () => zodJson(z.object({ email: z.string().trim() }))],
  ['a .catch() fallback', () => zodJson(z.object({ mode: z.string().catch('default') }))],
  ['a Date field', () => zodJson(z.object({ when: z.date() }))],
];

for (const [label, build] of wouldBeSilentlyLost) {
  try {
    build();
    console.log(`  \x1b[31m!\x1b[0m ${label} — ACCEPTED, so the constraint would vanish unnoticed`);
  } catch (error) {
    blocked(`${label} — refused at authoring time`);
  }
}

console.log('\nThe last group is the point: zod serialises all four without complaint, and the');
console.log('constraints simply stop being enforced. They are caught here, not in production.\n');

await client.close();
