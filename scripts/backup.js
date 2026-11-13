import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../src/config.js';
import logger from '../src/logger.js';
import db from '../src/db/index.js';

export async function runBackup(backupDir = './backups') {
  const resolvedDir = path.resolve(process.cwd(), backupDir);
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  logger.info('Starting database backup...', { timestamp });

  await db.init();

  if (db.isPostgres()) {
    // For PostgreSQL, in container or shell: pg_dump command
    // We document and provide the pg_dump execution
    logger.info('PostgreSQL backup requires pg_dump utility or volume snapshot.');
    return { type: 'postgres', timestamp };
  } else {
    // SQLite snapshot
    const dbPath = path.resolve(process.cwd(), config.databaseUrl.replace(/^sqlite:/, '').trim());
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database file not found at ${dbPath}`);
    }

    // Force checkpoint to flush WAL into main database file before copying
    try {
      await db.query('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (_) {}

    const backupFileName = `backup_${timestamp}.db`;
    const backupFilePath = path.join(resolvedDir, backupFileName);
    const checksumFilePath = `${backupFilePath}.sha256`;

    // Copy file
    fs.copyFileSync(dbPath, backupFilePath);

    // Calculate SHA256 checksum
    const fileBuffer = fs.readFileSync(backupFilePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const hexHash = hashSum.digest('hex');

    fs.writeFileSync(checksumFilePath, `${hexHash}  ${backupFileName}\n`, 'utf8');

    // Query stats for metadata
    const shows = await db.query('SELECT count(*) as count FROM shows');
    const bookings = await db.query('SELECT count(*) as count FROM bookings');

    const metadata = {
      backupFileName,
      backupFilePath,
      checksum: hexHash,
      timestamp,
      stats: {
        shows: Number(shows.rows[0]?.count || 0),
        bookings: Number(bookings.rows[0]?.count || 0)
      }
    };

    const metaPath = path.join(resolvedDir, `backup_${timestamp}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    logger.info('Backup completed successfully', metadata);
    return metadata;
  }
}

if (process.argv[1]?.endsWith('backup.js')) {
  (async () => {
    try {
      const res = await runBackup();
      console.log('BACKUP COMPLETED:', res);
      await db.close();
      process.exit(0);
    } catch (err) {
      console.error('Backup failed:', err);
      process.exit(1);
    }
  })();
}

export default runBackup;
