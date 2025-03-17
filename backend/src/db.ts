// src/db.ts
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

sqlite3.verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database', err);
  }
});

// Promisified functions for exec, all, and get
const exec = promisify(db.exec.bind(db));
const get = promisify(db.get.bind(db));


/**
 * Custom promise wrapper for db.run that returns the lastID.
 */
export function runQuery(sql: string, params: any[] = []): Promise<{ lastID: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err: Error | null) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID });
    });
  });
}

/**
 * Initialize the database and create tables if they don't exist.
 */
export async function initializeDB(): Promise<void> {
  // Credentials table
  await exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key TEXT NOT NULL,
      api_secret TEXT NOT NULL,
      trade_amount REAL NOT NULL,
      leverage INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Trades table
  await exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_type TEXT NOT NULL,
      symbol TEXT NOT NULL,
      trade_amount REAL NOT NULL,
      entry_price REAL NOT NULL,
      mark_price REAL NOT NULL,
      pnl REAL NOT NULL,
      roi REAL NOT NULL,
      realized_pnl TEXT NOT NULL,
      quote_qty TEXT NOT NULL,
      commission TEXT NOT NULL,
      commission_asset TEXT NOT NULL,
      side TEXT NOT NULL,
      time INTEGER NOT NULL,
      extra_info TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Settings table for trade counters
  await exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    );
  `);

  // Insert default counters if not existing
  await exec(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('maxTrades', 50), ('currentTrades', 0);
  `);
}

// Function to increment or decrement trade counters
export async function updateTradeCounter(increment: boolean = true): Promise<void> {
  const operation = increment ? '+' : '-';
  await runQuery(
    `UPDATE settings SET value = value ${operation} 1 WHERE key = 'currentTrades'`
  );
}

export async function queryAll(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export { queryAll as all, get, db };