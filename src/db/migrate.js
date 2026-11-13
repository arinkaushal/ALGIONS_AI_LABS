import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './index.js';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrate() {
  logger.info('Running database migrations...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Split SQL statements cleanly
  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await db.query(statement);
    } catch (err) {
      // Ignore if table/index already exists error, otherwise log
      if (!err.message.includes('already exists')) {
        logger.error('Failed executing migration statement', {
          statement: statement.substring(0, 100),
          error: err.message,
        });
        throw err;
      }
    }
  }

  logger.info('Database migrations applied successfully.');
}

// If executed directly from CLI: `node src/db/migrate.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      await db.init();
      await migrate();
      await db.close();
      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  })();
}

export default migrate;

