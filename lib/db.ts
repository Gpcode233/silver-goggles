import fs from "node:fs/promises";
import path from "node:path";

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "Ajently.sqlite");

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
let databasePromise: Promise<Database> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
  }
  return sqlJsPromise;
}

async function ensureDatabaseDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function initializeSchema(db: Database): Promise<void> {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      wallet_address TEXT NOT NULL UNIQUE,
      credits REAL NOT NULL DEFAULT 100
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      storage_hash TEXT,
      manifest_uri TEXT,
      manifest_tx_hash TEXT,
      knowledge_uri TEXT,
      knowledge_tx_hash TEXT,
      knowledge_local_path TEXT,
      knowledge_filename TEXT,
      creator_id INTEGER NOT NULL,
      price_per_run REAL NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(creator_id) REFERENCES users(id)
    );
  `);

  ensureColumn(db, "agents", "manifest_tx_hash", "TEXT");
  ensureColumn(db, "agents", "knowledge_tx_hash", "TEXT");

  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      input TEXT NOT NULL,
      output TEXT NOT NULL,
      cost REAL NOT NULL,
      compute_mode TEXT NOT NULL DEFAULT 'mock',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(agent_id) REFERENCES agents(id)
    );
  `);

  db.run(
    `
      INSERT OR IGNORE INTO users (id, wallet_address, credits)
      VALUES (1, ?, 100);
    `,
    [process.env.DEMO_WALLET_ADDRESS ?? "0xDEMO_WALLET_ADDRESS"],
  );
}

function ensureColumn(
  db: Database,
  tableName: string,
  columnName: string,
  columnDefinition: string,
): void {
  const statement = db.prepare(`PRAGMA table_info(${tableName});`);
  let exists = false;

  try {
    while (statement.step()) {
      const row = statement.getAsObject() as { name?: string };
      if (row.name === columnName) {
        exists = true;
        break;
      }
    }
  } finally {
    statement.free();
  }

  if (!exists) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`);
  }
}

async function loadDatabase(): Promise<Database> {
  await ensureDatabaseDir();
  const SQL = await getSqlJs();

  let db: Database;
  try {
    const bytes = await fs.readFile(DB_PATH);
    db = new SQL.Database(new Uint8Array(bytes));
  } catch {
    db = new SQL.Database();
  }

  await initializeSchema(db);
  return db;
}

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = loadDatabase();
  }
  return databasePromise;
}

async function persistDatabase(db: Database): Promise<void> {
  const bytes = db.export();
  await fs.writeFile(DB_PATH, Buffer.from(bytes));
}

export async function withRead<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const db = await getDatabase();
  return fn(db);
}

export async function withWrite<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const operation = writeQueue.then(async () => {
    const db = await getDatabase();
    const result = await fn(db);
    await persistDatabase(db);
    return result;
  });

  writeQueue = operation.catch(() => undefined);
  return operation;
}

type SqlParam = number | string | Uint8Array | null;

export function queryAll<T>(db: Database, sql: string, params: SqlParam[] = []): T[] {
  const statement = db.prepare(
    sql,
    params as Array<number | string | Uint8Array | null>,
  );
  const rows: T[] = [];

  try {
    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }
  } finally {
    statement.free();
  }

  return rows;
}

export function queryOne<T>(db: Database, sql: string, params: SqlParam[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

export function getLastInsertId(db: Database): number {
  const row = queryOne<{ id: number }>(db, "SELECT last_insert_rowid() AS id");
  return row?.id ?? 0;
}
