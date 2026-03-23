import fs from "node:fs/promises";
import path from "node:path";

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "Ajently.sqlite");

const DEMO_AGENTS = [
  {
    name: "Viral Hook Architect",
    description: "Crafts viral hooks, CTAs, and launch copy in seconds.",
    category: "Marketing",
    model: "meta-llama/llama-3.2-3b-instruct:free",
    systemPrompt:
      "You are a marketing copywriter who creates punchy hooks and CTAs tailored to the user's audience.",
    pricePerRun: 0.02,
    cardGradient: "sunset",
  },
  {
    name: "Pull Request Reviewer",
    description: "Reviews diffs, flags risks, and suggests fixes.",
    category: "Coding",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    systemPrompt:
      "You are a senior engineer reviewing pull requests for correctness, security, and clarity.",
    pricePerRun: 0.03,
    cardGradient: "ember",
  },
  {
    name: "Socratic Tutor",
    description: "Guides learners with questions, explanations, and quizzes.",
    category: "Education",
    model: "google/gemma-3-27b-it:free",
    systemPrompt:
      "You are a patient tutor who teaches by asking guiding questions and giving concise explanations.",
    pricePerRun: 0.02,
    cardGradient: "aurora",
  },
  {
    name: "Focus Sprint Coach",
    description: "Turns goals into focused 25-minute sprint plans.",
    category: "Productivity",
    model: "mistralai/mistral-small-3.1-24b-instruct:free",
    systemPrompt:
      "You are a productivity coach who turns goals into time-boxed action plans and checklists.",
    pricePerRun: 0.015,
    cardGradient: "ocean",
  },
  {
    name: "Market Intel Scout",
    description: "Summarizes competitor moves and trend signals.",
    category: "Research",
    model: "deepseek/deepseek-r1:free",
    systemPrompt:
      "You are a research analyst summarizing market signals, competitor activity, and key takeaways.",
    pricePerRun: 0.04,
    cardGradient: "cosmic",
  },
  {
    name: "Brand Moodboarder",
    description: "Generates visual style directions and moodboard prompts.",
    category: "Design",
    model: "black-forest-labs/flux.2-flex",
    systemPrompt:
      "You are a creative director who defines moodboards, palettes, and visual directions for brands.",
    pricePerRun: 0.05,
    cardGradient: "sunset",
  },
  {
    name: "Receipt Vision Auditor",
    description: "Inspects receipts and flags anomalies or missing fields.",
    category: "Finance",
    model: "qwen/qwen2.5-vl-32b-instruct:free",
    systemPrompt:
      "You analyze receipts and invoices, extracting key fields and spotting inconsistencies.",
    pricePerRun: 0.03,
    cardGradient: "ember",
  },
  {
    name: "All-Purpose Concierge",
    description: "Handles everyday tasks, brainstorming, and quick answers.",
    category: "General",
    model: "openrouter/free",
    systemPrompt: "You are a versatile assistant who handles daily requests with clarity and brevity.",
    pricePerRun: 0.01,
    cardGradient: "aurora",
  },
] as const;

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
      model TEXT NOT NULL DEFAULT 'openrouter/free',
      system_prompt TEXT NOT NULL,
      storage_hash TEXT,
      manifest_uri TEXT,
      manifest_tx_hash TEXT,
      knowledge_uri TEXT,
      knowledge_tx_hash TEXT,
      card_image_data_url TEXT,
      card_gradient TEXT NOT NULL DEFAULT 'aurora',
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
  ensureColumn(db, "agents", "card_image_data_url", "TEXT");
  ensureColumn(db, "agents", "card_gradient", "TEXT NOT NULL DEFAULT 'aurora'");
  ensureColumn(db, "agents", "model", "TEXT NOT NULL DEFAULT 'openrouter/free'");

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

  db.run(`
    CREATE TABLE IF NOT EXISTS topup_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      rail TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      credits REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider_reference TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS credit_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      amount REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  db.run(
    `
      INSERT OR IGNORE INTO users (id, wallet_address, credits)
      VALUES (1, ?, 100);
    `,
    [process.env.DEMO_WALLET_ADDRESS ?? "0xDEMO_WALLET_ADDRESS"],
  );

  seedDemoAgents(db);
}

function seedDemoAgents(db: Database): void {
  const statement = db.prepare(
    `
      INSERT INTO agents (
        name,
        description,
        category,
        model,
        system_prompt,
        creator_id,
        price_per_run,
        published,
        card_gradient
      )
      VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?);
    `,
  );

  try {
    for (const agent of DEMO_AGENTS) {
      const existing = queryOne<{ id: number }>(db, "SELECT id FROM agents WHERE name = ?", [
        agent.name,
      ]);
      if (existing) {
        continue;
      }
      statement.run([
        agent.name,
        agent.description,
        agent.category,
        agent.model,
        agent.systemPrompt,
        agent.pricePerRun,
        agent.cardGradient,
      ]);
    }
  } finally {
    statement.free();
  }
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
