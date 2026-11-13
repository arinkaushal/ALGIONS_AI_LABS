import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../src/config.js';
import logger from '../src/logger.js';
import db from '../src/db/index.js';

export async function runRestore(targetBackupFile = null, backupDir = './backups') {
  const resolvedDir = path.resolve(process.cwd(), backupDir);
  let backupPath = targetBackupFile;

  if (!backupPath) {
    // Find latest backup file in directory
    const files = fs.readdirSync(resolvedDir)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.db'))
      .sort()
      .reverse();

    if (files.length === 0) {
      throw new Error(`No backup files (.db) found in ${resolvedDir}`);
    }
    backupPath = path.join(resolvedDir, files[0]);
  } else {
    backupPath = path.resolve(process.cwd(), backupPath);
  }

  logger.info('Starting database restore from snapshot...', { backupPath });

  // 1. Verify SHA256 checksum
  const checksumFilePath = `${backupPath}.sha256`;
  if (fs.existsSync(checksumFilePath)) {
    const expectedChecksum = fs.readFileSync(checksumFilePath, 'utf8').trim().split(/\s+/)[0];
    const fileBuffer = fs.readFileSync(backupPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const calculatedChecksum = hashSum.digest('hex');

    if (expectedChecksum !== calculatedChecksum) {
      throw new Error(`Checksum verification failed! Expected: ${expectedChecksum}, Calculated: ${calculatedChecksum}`);
    }
    logger.info('SHA256 checksum verified successfully', { checksum: calculatedChecksum });
  } else {
    logger.warn('Checksum file not found, proceeding with caution');
  }

  // 2. Checkpoint and close active database connection
  try {
    await db.query('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (_) {}
  await db.close();

  // 3. Restore file
  const activeDbPath = path.resolve(process.cwd(), config.databaseUrl.replace(/^sqlite:/, '').trim());

  // Truncate or clean WAL/SHM safely
  const walPath = `${activeDbPath}-wal`;
  const shmPath = `${activeDbPath}-shm`;
  try {
    if (fs.existsSync(walPath)) fs.writeFileSync(walPath, Buffer.alloc(0));
    if (fs.existsSync(shmPath)) fs.writeFileSync(shmPath, Buffer.alloc(0));
  } catch (_) {}

  // Copy snapshot over active database
  fs.copyFileSync(backupPath, activeDbPath);

  // 4. Re-init database and verify row counts
  await db.init();
  const shows = await db.query('SELECT count(*) as count FROM shows');
  const bookings = await db.query('SELECT count(*) as count FROM bookings');

  const verificationResult = {
    restoredFrom: backupPath,
    showsCount: Number(shows.rows[0]?.count || 0),
    bookingsCount: Number(bookings.rows[0]?.count || 0),
    restoredAt: new Date().toISOString()
  };

  logger.info('Database restore and integrity verification completed successfully', verificationResult);
  return verificationResult;
}

if (process.argv[1]?.endsWith('restore.js')) {
  (async () => {
    try {
      const target = process.argv[2] || null;
      const res = await runRestore(target);
      console.log('RESTORE COMPLETED:', res);
      await db.close();
      process.exit(0);
    } catch (err) {
      console.error('Restore failed:', err);
      process.exit(1);
    }
  })();
}

export default runRestore;
