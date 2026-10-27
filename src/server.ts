import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { closePool } from './db/postgres';
import { closeRedis } from './db/redis';
import { runMigrations } from './db/migrate';

async function bootstrap() {
  try {
    if (env.NODE_ENV !== 'test') {
      logger.info('Executing database migrations...');
      await runMigrations();
      logger.info('Database migrations applied successfully');
    }

    const server = app.listen(env.PORT, env.HOST, () => {
      logger.info(`Auth Service listening on http://${env.HOST}:${env.PORT} in ${env.NODE_ENV} mode`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await closePool();
        await closeRedis();
        logger.info('Closed all database connections. Exiting process.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start Auth Service');
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}
