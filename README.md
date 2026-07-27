# prisma-next-zod-json-example

A small webhook receiver built on [Prisma Next](https://github.com/prisma/prisma-next) and
[`prisma-next-zod-json`](https://github.com/omar-dulaimi/prisma-next-zod-json), showing typed JSON
columns doing real work.

Two columns carry documents rather than scalars, and both are genuine cases for JSON rather than lazy
ones:

- `WebhookEvent.payload`: a **discriminated union**. Each event kind has a different shape; the
  alternative is a dozen mostly-null columns.
- `Tenant.settings`, nested per-tenant configuration, partly optional.

Both are declared once, in `src/prisma/schemas.ts`, as ordinary zod schemas.

## Run it

```sh
pnpm install
pnpm setup     # starts Postgres, emits the contract, creates the database
pnpm tour      # the guided demonstration
pnpm seed && pnpm start
```

## What the tour shows

```
2. Invalid writes are rejected before they reach the table
  ⨯ an unknown event kind (kind) Invalid input: expected "payment.succeeded"
  ⨯ a negative amount (amountCents) Too small: expected number to be >0
  ⨯ an unsupported currency (currency) Invalid option: expected one of "gbp"|"usd"|"eur"
  ⨯ a malformed email (email) Invalid email address
  ✓ 1 event for this tenant, none of the six rejections landed
```

The HTTP handlers in `src/server.ts` do **no validation of their own**. They pass the parsed request
body straight to the database and turn a codec rejection into a 422. That is only safe because the
column validates on write, with read-only validation the row would commit and fail later, in someone
else's request.

## The types are real

`prisma-next contract emit` renders the column's TypeScript type from the stored schema, so
`contract.d.ts` contains:

```ts
readonly payload:
  | { kind: 'payment.succeeded'; amountCents: number; currency: 'gbp' | 'usd' | 'eur'; reference: string }
  | { kind: 'payment.refunded'; amountCents: number; currency: 'gbp' | 'usd' | 'eur'; reason: 'duplicate' | 'fraudulent' | 'requested_by_customer' }
  | { kind: 'user.created'; email: string; plan: 'free' | 'pro' | 'enterprise' };
```

A real union, so narrowing on `kind` works downstream. CI asserts this rather than trusting it: if it
regressed to `unknown` the app would still run, and every consumer would quietly lose their types.

## Notes for anyone copying this

- The column goes in as `field.column(zodJson(Schema))`.
- Registration happens in three places, and each failure is loud and specific:
  `extensionPacks` in the object the `defineContract` callback returns (`src/prisma/contract.ts`),
  `extensions` in `prisma-next.config.ts` for DDL, and `extensions` on the runtime client
  (`src/db.ts`).
- **A relative import inside `contract.ts` needs its explicit `.ts` extension**: the contract loader
  resolves neither `./schemas` nor `./schemas.js`. That needs `allowImportingTsExtensions` in
  `tsconfig.json`.
- `TenantSettings` uses `strictObject`. Zod's default object strips unknown keys and JSON Schema cannot
  express "strip", so being explicit keeps the column's behaviour identical to the schema's.
- Models hang off the namespace: `db.orm.public.Tenant`. Writes are `create(data)`; reads are `all()`
  and `first()`, filtered with `.where(m => m.field.eq(value))`.

## The library

[`prisma-next-zod-json`](https://www.npmjs.com/package/prisma-next-zod-json) is on npm; this app
depends on the published package like any other consumer. That is the point: it checks the package
works from the registry, not merely in its own test suite.
