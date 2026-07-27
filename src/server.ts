import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { db } from './db.js';

/**
 * A webhook receiver.
 *
 * The point of the example: these handlers do **no validation of their own**. They pass the parsed
 * request body straight to the database. The `payload` and `settings` columns are typed JSON, so the
 * codec validates on write and rejects anything that does not match the zod schema, naming the field
 * that was wrong.
 *
 * Without write validation this would be reckless: the row would commit and blow up later on read, in
 * some unrelated request belonging to someone else.
 */
const app = new Hono();

/** Turns a codec rejection into a 422 the caller can act on; anything else is a genuine 500. */
function handleWriteError(error: unknown): { status: 422 | 500; body: Record<string, unknown> } {
  const message = error instanceof Error ? error.message : String(error);
  const details = (error as { details?: { codecId?: string; phase?: string; issues?: unknown } }).details;

  if (details?.codecId === 'zod/json@1' && details.phase === 'encode') {
    return { status: 422, body: { error: 'the payload does not match the schema', issues: details.issues } };
  }
  return { status: 500, body: { error: message } };
}

app.post('/tenants', async (c) => {
  const body = (await c.req.json()) as { slug?: unknown; settings?: unknown };
  try {
    const tenant = await db.Tenant.create({ slug: body.slug, settings: body.settings });
    return c.json(tenant, 201);
  } catch (error) {
    const { status, body: payload } = handleWriteError(error);
    return c.json(payload, status);
  }
});

app.get('/tenants/:slug', async (c) => {
  const slug = c.req.param('slug');
  const tenant = await db.Tenant.where((m: Record<string, { eq(v: unknown): unknown }>) =>
    m['slug']!.eq(slug),
  ).first();

  return tenant ? c.json(tenant) : c.json({ error: 'no such tenant' }, 404);
});

app.post('/webhooks/:slug', async (c) => {
  const payload = await c.req.json();
  try {
    const event = await db.WebhookEvent.create({ tenantSlug: c.req.param('slug'), payload });
    return c.json(event, 201);
  } catch (error) {
    const { status, body } = handleWriteError(error);
    return c.json(body, status);
  }
});

app.get('/webhooks/:slug', async (c) => {
  const slug = c.req.param('slug');
  const events = await db.WebhookEvent.where((m: Record<string, { eq(v: unknown): unknown }>) =>
    m['tenantSlug']!.eq(slug),
  ).all();

  return c.json(events);
});

const port = Number(process.env['PORT'] ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`listening on http://localhost:${port}`);

export { app };
