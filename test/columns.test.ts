import { afterAll, describe, expect, test } from 'vitest';
import { client, db } from '../src/db.js';

/**
 * Integration tests against a real database, from the consumer's side.
 *
 * The library has its own suite; these check the thing an application actually cares about: that a
 * bad payload cannot be written, and that a good one survives the round trip with its shape.
 */

const run = Date.now().toString(36);
const slug = `test-${run}`;

const settings = {
  displayName: 'Test Co',
  locale: 'en-GB',
  notifications: { email: true },
  retryPolicy: { maxAttempts: 2, backoff: 'fixed' as const },
  tags: ['a'],
};

afterAll(async () => {
  await client.close();
});

describe('tenant settings', () => {
  test('a valid settings document round-trips with its nesting intact', async () => {
    await db.Tenant.create({ slug, settings });

    const stored = await db.Tenant.where((m: Record<string, { eq(v: unknown): unknown }>) =>
      m['slug']!.eq(slug),
    ).first();

    expect(stored?.['settings']).toEqual(settings);
  });

  test('an undeclared key is refused, because the schema is a strictObject', async () => {
    await expect(
      db.Tenant.create({ slug: `${slug}-x`, settings: { ...settings, colour: 'red' } }),
    ).rejects.toThrow(/colour/);
  });

  test('an out-of-range nested value is refused, naming its path', async () => {
    await expect(
      db.Tenant.create({
        slug: `${slug}-y`,
        settings: { ...settings, retryPolicy: { maxAttempts: 99, backoff: 'fixed' } },
      }),
    ).rejects.toThrow(/maxAttempts/);
  });
});

describe('webhook payloads', () => {
  const valid = { kind: 'payment.succeeded', amountCents: 1500, currency: 'gbp', reference: 'r-1' };

  test('a valid event is stored', async () => {
    const created = await db.WebhookEvent.create({ tenantSlug: slug, payload: valid });

    expect(created['payload']).toEqual(valid);
  });

  test.each([
    ['an unknown kind', { kind: 'nope', amountCents: 1 }, /kind/],
    ['a negative amount', { ...valid, amountCents: -1 }, /amountCents/],
    ['a fractional amount', { ...valid, amountCents: 1.5 }, /amountCents/],
    ['an unsupported currency', { ...valid, currency: 'yen' }, /currency/],
    ['a malformed email', { kind: 'user.created', email: 'nope', plan: 'pro' }, /email/],
  ])('%s is refused', async (_label, payload, expected) => {
    await expect(db.WebhookEvent.create({ tenantSlug: slug, payload })).rejects.toThrow(expected);
  });

  test('nothing invalid reached the table', async () => {
    const stored = await db.WebhookEvent.where((m: Record<string, { eq(v: unknown): unknown }>) =>
      m['tenantSlug']!.eq(slug),
    ).all();

    expect(stored).toHaveLength(1);
  });
});
