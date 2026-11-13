import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import config from '../config.js';
import logger from '../logger.js';
import { databaseConnectedGauge } from '../metrics.js';

const { Pool } = pg;

class AsyncMutex {
  constructor() {
    this.queue = [];
    this.locked = false;
  }

  async acquire() {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.locked = true;
        resolve(() => this.release());
      });
    });
  }

  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }
}

class DatabaseManager {
  constructor() {
    this.isPg = false;
    this.sqliteDb = null;
    this.sqliteMutex = new AsyncMutex();
    this.pgPool = null;
    this.initialized = false;
  }

  async init(overrideUrl = null) {
    const dbUrl = overrideUrl || config.databaseUrl;

    if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
      this.isPg = true;
      this.pgPool = new Pool({
        connectionString: dbUrl,
        max: config.dbMaxConnections,
        idleTimeoutMillis: config.dbIdleTimeoutMillis,
        connectionTimeoutMillis: config.dbConnectionTimeoutMillis,
      });

      this.pgPool.on('error', (err) => {
        logger.error('Unexpected error on idle PostgreSQL client', { error: err });
        databaseConnectedGauge.set(0);
      });

      // Test initial connection
      const client = await this.pgPool.connect();
      try {
        await client.query('SELECT 1');
        databaseConnectedGauge.set(1);
        logger.info('Connected successfully to PostgreSQL database', {
          url: dbUrl.replace(/:[^:@]+@/, ':***@')
        });
      } finally {
        client.release();
      }
    } else {
      // SQLite mode
      this.isPg = false;
      let dbPath = dbUrl.replace(/^sqlite:/, '').trim();
      
      if (dbPath !== ':memory:') {
        const fullPath = path.resolve(process.cwd(), dbPath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        dbPath = fullPath;
      }

      this.sqliteDb = new DatabaseSync(dbPath);
      try {
        this.sqliteDb.exec('PRAGMA journal_mode = WAL;');
        this.sqliteDb.exec('PRAGMA busy_timeout = 5000;');
        this.sqliteDb.exec('PRAGMA foreign_keys = ON;');
      } catch (err) {
        logger.warn('Could not set WAL pragma on SQLite', { error: err.message });
      }

      databaseConnectedGauge.set(1);
      logger.info('Connected successfully to SQLite database', { path: dbPath });
    }

    this.initialized = true;
  }

  isPostgres() {
    return this.isPg;
  }

  convertSqlForPostgres(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  async query(sql, params = []) {
    if (!this.initialized) {
      await this.init();
    }

    if (this.isPg) {
      const pgSql = this.convertSqlForPostgres(sql);
      const res = await this.pgPool.query(pgSql, params);
      return {
        rows: res.rows,
        rowCount: res.rowCount,
      };
    } else {
      const trimmed = sql.trim().toUpperCase();
      const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA');
      const stmt = this.sqliteDb.prepare(sql);

      if (isSelect) {
        const rows = stmt.all(...params);
        return {
          rows,
          rowCount: rows.length,
        };
      } else {
        const result = stmt.run(...params);
        return {
          rows: [],
          rowCount: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        };
      }
    }
  }

  async transaction(callback) {
    if (!this.initialized) {
      await this.init();
    }

    if (this.isPg) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        const trxRunner = {
          query: async (sql, params = []) => {
            const pgSql = this.convertSqlForPostgres(sql);
            const res = await client.query(pgSql, params);
            return {
              rows: res.rows,
              rowCount: res.rowCount,
            };
          }
        };
        const result = await callback(trxRunner);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // In SQLite, acquire mutex to serialize concurrent transaction scopes on single connection
      const release = await this.sqliteMutex.acquire();
      try {
        this.sqliteDb.exec('BEGIN IMMEDIATE');
        const trxRunner = {
          query: async (sql, params = []) => {
            const trimmed = sql.trim().toUpperCase();
            const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA');
            const stmt = this.sqliteDb.prepare(sql);
            if (isSelect) {
              const rows = stmt.all(...params);
              return { rows, rowCount: rows.length };
            } else {
              const res = stmt.run(...params);
              return { rows: [], rowCount: res.changes, lastInsertRowid: res.lastInsertRowid };
            }
          }
        };

        const result = await callback(trxRunner);
        this.sqliteDb.exec('COMMIT');
        return result;
      } catch (err) {
        try {
          this.sqliteDb.exec('ROLLBACK');
        } catch (_) {}
        throw err;
      } finally {
        release();
      }
    }
  }

  async ping() {
    try {
      if (this.isPg) {
        if (!this.pgPool) return false;
        const res = await this.pgPool.query('SELECT 1 AS ok');
        const healthy = res.rows && res.rows.length > 0;
        databaseConnectedGauge.set(healthy ? 1 : 0);
        return healthy;
      } else {
        if (!this.sqliteDb) return false;
        const res = this.sqliteDb.prepare('SELECT 1 AS ok').all();
        const healthy = res && res.length > 0;
        databaseConnectedGauge.set(healthy ? 1 : 0);
        return healthy;
      }
    } catch (err) {
      logger.error('Database ping failed', { error: err.message });
      databaseConnectedGauge.set(0);
      return false;
    }
  }

  async close() {
    try {
      if (this.isPg && this.pgPool) {
        await this.pgPool.end();
        this.pgPool = null;
      } else if (this.sqliteDb) {
        this.sqliteDb.close();
        this.sqliteDb = null;
      }
      this.initialized = false;
      databaseConnectedGauge.set(0);
    } catch (err) {
      logger.error('Error closing database', { error: err.message });
    }
  }
}

export const db = new DatabaseManager();
export default db;
