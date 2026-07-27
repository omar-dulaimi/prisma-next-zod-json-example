import 'dotenv/config';
import postgres from '@prisma-next/postgres/runtime';
import { zodJsonRuntimeDescriptor } from 'prisma-next-zod-json/runtime';
import contractJson from './prisma/contract.json' with { type: 'json' };

/**
 * The runtime plane. Without the descriptor here, constructing the client fails immediately with
 * "no contributor registered a codec descriptor" rather than misbehaving later.
 */
export const client = postgres({
  contractJson,
  url: process.env['DATABASE_URL']!,
  extensions: [zodJsonRuntimeDescriptor],
} as never) as never as AppClient;

type Row = Record<string, unknown>;
type Collection = {
  create(data: unknown): Promise<Row>;
  all(): Promise<Row[]>;
  where(predicate: unknown): { all(): Promise<Row[]>; first(): Promise<Row | undefined> };
  first(): Promise<Row | undefined>;
};

type AppClient = {
  orm: { public: { Tenant: Collection; WebhookEvent: Collection } };
  close(): Promise<void>;
};

export const db = client.orm.public;
