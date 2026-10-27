import fs from 'fs';
import path from 'path';
import { query } from './postgres';
import { logger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  if (!fs.existsSync(migrationsDir)) {
    logger.warn(`Migrations directory not found at: ${migrationsDir}`);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    logger.info(`Running migration: ${file}`);
    await query(sql);
    logger.info(`Completed migration: ${file}`);
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('All migrations executed successfully');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Migration execution failed');
      process.exit(1);
    });
}
