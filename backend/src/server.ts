import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './shared/config/db.js';
import { verifyCloudinary } from './shared/config/cloudinary.js';
import { env } from './shared/config/env.js';
import { logger } from './shared/config/logger.js';

async function main(): Promise<void> {
  await connectDatabase();
  /** Non-blocking: bad upload creds must not stop players booking courts. */
  void verifyCloudinary();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'BoxArena API listening');
  });

  const { initWebSocketServer } = await import('./shared/services/socket.js');
  initWebSocketServer(server);

  /**
   * Graceful shutdown. Killing a pod mid-transaction is how you get orphaned
   * slot holds and half-written ledgers (edge_cases.md §104).
   */
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectDatabase().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 15_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
// Trigger reload after env update and Firebase connection
