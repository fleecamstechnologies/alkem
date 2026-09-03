import { join } from 'path';
import type { DataSourceOptions } from 'typeorm';

/**
 * Single source of truth for the DB connection, shared by the Nest runtime
 * (app.module) and the TypeORM CLI (data-source.ts) so migrations and the app
 * never drift apart.
 *
 * Performance-relevant knobs:
 *  - connectionLimit: pool size. ~20 is plenty for a single API node; raise with
 *    the number of nodes, keeping total connections well under MySQL max_connections.
 *  - bulk imports already build one multi-row INSERT per chunk via the query
 *    builder, so no extra driver flag is needed for fast loads.
 *  - synchronize is always false: schema changes go through migrations only.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  const isCompiled = __filename.endsWith('.js');
  const root = join(__dirname, '..');

  return {
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'alkem',
    password: process.env.DB_PASSWORD ?? 'alkempassword',
    database: process.env.DB_DATABASE ?? 'alkem_portal',
    entities: [join(root, '**', '*.entity.{ts,js}')],
    migrations: [join(root, 'migrations', isCompiled ? '*.js' : '*.ts')],
    synchronize: false,
    migrationsRun: false,
    timezone: 'Z',
    charset: 'utf8mb4',
    extra: {
      connectionLimit: Number(process.env.DB_POOL_SIZE ?? 20),
      waitForConnections: true,
      connectTimeout: 10_000,
    },
  };
}
