import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * MongoDB connection.
 *
 * ⚠️ Transactions require a REPLICA SET. On a standalone mongod, sessions are
 * silently ignored and every wallet guarantee in this codebase disappears
 * without a single error (edge_cases.md §98). We verify at boot rather than
 * discovering it in production.
 */

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.set('strictQuery', true);

  /**
   * NOTE ON `sanitizeFilter` (edge_cases.md §100).
   *
   * We deliberately do NOT enable it globally. It rewrites EVERY object-valued
   * filter into `{ $eq: <object> }`, including the ones the server builds
   * itself — `{ expiresAt: { $gt: now } }` becomes
   * `{ expiresAt: { $eq: { $gt: now } } }` and throws a CastError. Making it
   * usable would mean wrapping every legitimate `$gt`/`$in`/`$exists` query in
   * `mongoose.trusted()`, and a single missed one is a 500 on a rarely-hit path
   * such as a cron sweep.
   *
   * The actual guarantee is at the boundary instead: every request is parsed by
   * a Zod schema with `.strict()` and typed fields, so `{"phone":{"$ne":null}}`
   * fails validation before it can ever reach a query. That is enforced in one
   * place and is impossible to forget.
   *
   * THE RULE THIS DEPENDS ON: never pass `req.body` / `req.query` values into a
   * filter without parsing them through Zod first (code_standards.md §4).
   */

  await mongoose.connect(uri, {
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    serverSelectionTimeoutMS: 10_000,
  });

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    await assertReplicaSet();
  }
  logger.info('MongoDB connected');
}

/**
 * Fails loudly at boot if transactions would be a no-op. Costs one admin
 * command; saves you from a silently non-atomic wallet.
 */
async function assertReplicaSet(): Promise<void> {
  const admin = mongoose.connection.db?.admin();
  if (!admin) throw new Error('No database handle after connect');

  const info = (await admin.command({ hello: 1 })) as { setName?: string; msg?: string };
  const isReplicaSet = Boolean(info.setName) || info.msg === 'isdbgrid';

  if (!isReplicaSet) {
    throw new Error(
      'MongoDB is NOT a replica set. Transactions would silently no-op and the ' +
        'wallet would lose atomicity. Start with: mongod --replSet rs0, then rs.initiate(). ' +
        'See edge_cases.md §98.',
    );
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

/**
 * Wraps the session boilerplate once. Every multi-document write that touches
 * money must go through this (technical_spec.md §2, rule 3).
 *
 * ⚠️ `withTransaction` RETRIES on transient errors, so `fn` must be idempotent
 * and free of side effects — no notifications, no emails, no external calls
 * inside it. Send those after commit (edge_cases.md §91).
 */
export async function withTransaction<T>(
  fn: (session: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    // Safe: withTransaction throws if the callback never completed.
    return result!;
  } finally {
    await session.endSession();
  }
}
