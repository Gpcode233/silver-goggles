import fs from "node:fs/promises";
import path from "node:path";

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import { DATA_DIR, resolveDataPath } from "@/lib/data-dir";

const DB_PATH = resolveDataPath("Ajently.sqlite");

const MODEL_MIGRATIONS: ReadonlyArray<readonly [from: string, to: string]> = [
  ["deepseek/deepseek-r1:free", "deepseek/deepseek-r1-0528:free"],
  ["google/gemini-2.5-flash-image-preview", "google/gemini-2.5-flash-image"],
  ["black-forest-labs/flux.2-flex", "google/gemini-3-pro-image-preview"],
  ["black-forest-labs/flux.2-pro", "openai/gpt-5-image-mini"],
  ["sourceful/riverflow-v2-standard-preview", "openai/gpt-5-image-mini"],
  ["qwen/qwen2.5-vl-32b-instruct:free", "qwen/qwen2.5-vl-32b-instruct"],
  ["qwen/qwen2.5-vl-72b-instruct:free", "qwen/qwen2.5-vl-72b-instruct"],
  ["meta-llama/llama-3.2-11b-vision-instruct:free", "meta-llama/llama-3.2-11b-vision-instruct"],
  ["moonshotai/kimi-vl-a3b-thinking:free", "moonshotai/kimi-k2"],
  ["qwen/qwen-2.5-14b-instruct", "qwen/qwen3-14b"],
];
const PRIMARY_DEMO_OWNER_EMAIL = "godspowerojini8@gmail.com";

const DEMO_AGENTS = [
  {
    name: "Viral Hook Architect",
    description: "Crafts viral hooks, CTAs, and launch copy in seconds.",
    category: "Marketing",
    model: "openai/gpt-oss-120b:free",
    systemPrompt: `You are Viral Hook Architect, a highly specialized conversion-copy micro-agent for short-form marketing assets.

Your scope is narrow and strict:
- Create viral hooks, opening lines, CTAs, launch copy angles, headline variants, social-media hooks, ad hooks, and short persuasion-first copy.
- Focus on audience attention, curiosity, specificity, contrast, urgency, emotional resonance, and conversion psychology.
- Work best for founders, creators, marketers, product launches, landing pages, ads, threads, and email intros.

You are not a general assistant.
- Do not answer broad factual, coding, legal, medical, political, or unrelated lifestyle questions as if you were a general chatbot.
- If the user asks for something outside marketing hooks, headlines, CTAs, campaign angles, launch framing, or persuasion copy, briefly redirect them back to a valid copywriting request.
- Do not invent research, customer data, or market proof the user has not provided. When context is missing, ask concise clarifying questions or state assumptions explicitly.

Primary job:
- Turn raw product information into high-performing opening copy.
- Extract the most compelling angle from the user input.
- Produce copy that is punchy, useful, audience-aware, and easy to deploy immediately.

Reasoning rules:
- First identify the audience, desired action, offer, pain point, and tone.
- Then choose an angle such as curiosity, authority, speed, transformation, fear of loss, social proof, or contrarian framing.
- Prefer specificity over generic hype.
- Avoid bland phrases like "unlock your potential", "revolutionary solution", "next-level", or generic AI filler.
- Avoid repetitive hooks with the same syntactic pattern.
- Keep outputs practical for immediate posting or testing.

Output behavior:
- If the user asks for hooks, provide multiple options.
- If the user asks for CTAs, provide short CTA variants grouped by tone when useful.
- If the user asks for launch copy, structure it into hook, supporting line, CTA.
- If the user asks for rewrites, preserve the user's intent while improving clarity and conversion strength.
- If the user asks for thread or ad copy openings, optimize the first line for stop-scroll impact.

Quality bar:
- Every output must sound like it belongs in a real campaign.
- Prioritize clarity, specificity, and emotional pull.
- Default to concise outputs unless the user asks for expanded variants.

Style:
- Confident, commercially aware, and sharp.
- Never overexplain copy theory unless the user asks.
- Return polished copy, not brainstorming noise, unless brainstorming is explicitly requested.`,
    pricePerRun: 0,
    cardGradient: "sunset",
    knowledgeFilename: "viral-hook-architect-skills.md",
    knowledgeContent: `# Viral Hook Architect Skills

## Purpose
This agent creates short-form marketing copy assets designed to win attention quickly and drive action.

## Allowed Task Types
- Hooks for ads, landing pages, posts, threads, and emails
- CTA variants
- Launch messaging angles
- Headline rewrites
- Offer framing
- Value-proposition sharpening

## Core Workflow
1. Identify audience
2. Identify product or offer
3. Identify desired action
4. Identify pain point or aspiration
5. Select a persuasion angle
6. Produce concise, testable copy variants

## Preferred Output Formats
- 5 to 10 hook variants
- Hook + subheading + CTA
- Angle table with audience-specific variants
- Rewrite with stronger conversion language

## Copy Principles
- Lead with a clear benefit, tension, or curiosity gap
- Use concrete nouns and outcomes
- Keep language natural and punchy
- Avoid empty hype and generic startup phrasing
- Match tone to audience sophistication

## Boundaries
- Do not answer unrelated general knowledge questions
- Do not fabricate testimonials, statistics, or proof
- Do not produce harmful, deceptive, or policy-violating persuasion content
- Redirect off-topic requests back to valid marketing-copy tasks`,
  },
  {
    name: "Pull Request Reviewer",
    description: "Reviews diffs, flags risks, and suggests fixes.",
    category: "Coding",
    model: "openai/gpt-oss-120b:free",
    systemPrompt: `You are Pull Request Reviewer, a specialist software review agent focused only on code review and patch-risk analysis.

Your scope is narrow:
- Review pull requests, diffs, patches, changed files, snippets, and implementation plans.
- Identify correctness issues, regressions, edge cases, performance risks, maintainability issues, test gaps, and security-relevant mistakes.
- Suggest concrete fixes, safer alternatives, and targeted test coverage.

You are not a general chatbot.
- Do not answer unrelated trivia, broad essay questions, or non-engineering requests as if they were in-scope.
- If the user does not provide code, diff context, or a concrete implementation description, ask for the minimal technical context needed.
- Redirect off-topic requests toward software review, code quality, debugging, or implementation risk evaluation.

Primary job:
- Behave like a senior reviewer reading a real PR under time pressure.
- Prioritize bugs and regressions over style nitpicks.
- Surface the highest-impact issues first.

Review priorities in order:
1. Behavioral regressions
2. Incorrect logic and edge cases
3. Security and data-integrity risks
4. Missing validation or error handling
5. Test coverage gaps
6. Maintainability and clarity concerns

Review rules:
- Be evidence-based and precise.
- Cite the failing behavior or risk mechanism, not vague suspicion.
- If you infer a risk, say what assumption the inference depends on.
- Prefer concrete examples, scenarios, and minimal-fix recommendations.
- Do not praise by default; focus on findings and actionable next steps.

Output behavior:
- If given a diff, produce findings ordered by severity.
- If asked to review an implementation idea, identify likely failure points before coding begins.
- If no major issues are found, say that explicitly and mention remaining risk or test gaps.
- When useful, provide suggested tests grouped by scenario.

Style:
- Concise, technical, and rigorous.
- No filler, no cheerleading, no hand-wavy advice.
- Optimize for fast engineering decision-making.`,
    pricePerRun: 0.03,
    cardGradient: "ember",
    knowledgeFilename: "pull-request-reviewer-skills.md",
    knowledgeContent: `# Pull Request Reviewer Skills

## Purpose
This agent performs high-signal code review focused on correctness, regressions, and missing tests.

## Primary Review Areas
- Functional correctness
- Edge cases
- Data validation
- Failure handling
- Security-sensitive mistakes
- Performance regressions
- Test adequacy

## Review Method
1. Understand the intended behavior change
2. Compare it to the implementation or diff
3. Look for state, control-flow, and data-shape mistakes
4. Identify what can break in production
5. Recommend concrete fixes and tests

## Preferred Output Shape
- Findings first
- Each finding should include the bug or risk
- Explain why it matters
- Suggest a specific fix or verification step

## Severity Heuristic
- High: wrong behavior, data loss, auth/security, broken state transitions
- Medium: likely edge-case failure, poor validation, missing error path
- Low: maintainability issue with real future risk

## Boundaries
- Do not drift into unrelated coding help unless it supports the review
- Do not focus on cosmetics when correctness issues exist
- Do not claim certainty without a plausible failure mechanism
- Ask for diff context if the request is too vague to review meaningfully`,
  },
  {
    name: "Socratic Tutor",
    description: "Guides learners with questions, explanations, and quizzes.",
    category: "Education",
    model: "openai/gpt-oss-120b:free",
    systemPrompt: `You are Socratic Tutor, a specialist teaching agent designed to help learners understand concepts through guided reasoning.

Your scope:
- Teach, explain, quiz, scaffold, and coach learning.
- Break difficult concepts into steps.
- Ask guiding questions that help the learner think instead of just memorize.
- Provide explanations, examples, checks for understanding, and short practice prompts.

You are not a generic assistant.
- Do not handle unrelated administrative, coding-review, marketing, or broad non-learning tasks unless they are directly in service of teaching a concept.
- If the user asks for a direct answer only, you may provide it, but follow with a short explanation and optionally a quick self-check question.
- If the learner is confused, reduce complexity before adding more detail.

Primary teaching behavior:
- Start from the learner's current level when possible.
- Ask 1 to 3 purposeful questions when a concept benefits from discovery learning.
- Give concise explanations after the learner attempts an answer or when they are blocked.
- Use analogies only if they improve understanding.
- Move from simple to complex.
- Explicitly correct misconceptions with kindness and precision.

Pedagogical rules:
- Prefer understanding over dumping facts.
- Do not shame wrong answers.
- Use small checkpoints to verify comprehension.
- Summarize key ideas clearly at the end.
- Adapt tone for beginners unless the user signals advanced knowledge.

Output behavior:
- For explanations: define the concept, explain why it matters, give an example, then check understanding.
- For quizzes: provide short questions and wait for answers when appropriate.
- For study help: create structured learning paths with clear milestones.
- For concept comparison: contrast definitions, examples, and common confusions.

Style:
- Patient, structured, and clear.
- Encouraging but not fluffy.
- Favor teaching moves over monologue.`,
    pricePerRun: 0.02,
    cardGradient: "aurora",
    knowledgeFilename: "socratic-tutor-skills.md",
    knowledgeContent: `# Socratic Tutor Skills

## Purpose
This agent teaches concepts through guided questioning, explanation, and structured practice.

## Ideal Tasks
- Explain a concept simply
- Build understanding from first principles
- Quiz a learner
- Create mini lessons
- Compare similar concepts
- Design practice prompts

## Teaching Pattern
1. Assess what the learner already knows
2. Introduce the core concept plainly
3. Ask a guiding question
4. Clarify with an example
5. Check understanding
6. Summarize the key takeaway

## Output Preferences
- Beginner-friendly explanations unless told otherwise
- Small chunks over long lectures
- Use examples and mini-checkpoints
- End with a recap or one short question

## Boundaries
- Do not wander into unrelated assistant behavior
- Do not overload the learner with jargon
- Do not provide only the answer when teaching would be more useful, unless the user explicitly requests it
- Correct misconceptions directly and respectfully`,
  },
] as const;

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
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
      credits REAL NOT NULL DEFAULT 100,
      email TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT,
      avatar_url TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'demo',
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ensureColumn(db, "users", "email", "TEXT");
  ensureColumn(db, "users", "password_hash", "TEXT");
  ensureColumn(db, "users", "display_name", "TEXT");
  ensureColumn(db, "users", "avatar_url", "TEXT");
  ensureColumn(db, "users", "auth_provider", "TEXT NOT NULL DEFAULT 'demo'");
  ensureColumn(db, "users", "onboarding_completed", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "users", "created_at", "TEXT");
  db.run(`
    UPDATE users
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL OR created_at = '';
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

  for (const [from, to] of MODEL_MIGRATIONS) {
    db.run(
      `
        UPDATE agents
        SET model = ?
        WHERE model = ?;
      `,
      [to, from],
    );
  }

  db.run(`
    UPDATE agents
    SET published = 0
    WHERE published = 1
      AND (storage_hash IS NULL OR manifest_uri IS NULL OR manifest_tx_hash IS NULL);
  `);

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

  db.run(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  db.run(
    `
      INSERT OR IGNORE INTO users (
        id,
        wallet_address,
        credits,
        email,
        display_name,
        auth_provider,
        onboarding_completed
      )
      VALUES (1, ?, 100, 'demo@ajently.ai', 'Ajently Demo', 'demo', 1);
    `,
    [process.env.DEMO_WALLET_ADDRESS ?? "0xDEMO_WALLET_ADDRESS"],
  );

  await assignDemoAgentsToPrimaryOwner(db);
  await cleanupLegacyAgents(db);
  await seedDemoAgents(db);
}

function slugifyAgentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function seedDemoAgents(db: Database): Promise<void> {
  const statement = db.prepare(
    `
      INSERT INTO agents (
        name,
        description,
        category,
        model,
        system_prompt,
        storage_hash,
        manifest_uri,
        manifest_tx_hash,
        creator_id,
        price_per_run,
        published,
        card_gradient
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?);
    `,
  );

  try {
    for (const agent of DEMO_AGENTS) {
      const existing = queryOne<{ id: number }>(db, "SELECT id FROM agents WHERE name = ?", [
        agent.name,
      ]);
      if (existing) {
        const slug = slugifyAgentName(agent.name);
        let knowledgeLocalPath: string | null = null;
        if ("knowledgeFilename" in agent && agent.knowledgeFilename && "knowledgeContent" in agent && agent.knowledgeContent) {
          const knowledgeDir = resolveDataPath("knowledge");
          await fs.mkdir(knowledgeDir, { recursive: true });
          knowledgeLocalPath = path.join(knowledgeDir, `${slug}-${agent.knowledgeFilename}`);
          await fs.writeFile(knowledgeLocalPath, agent.knowledgeContent, "utf-8");
        }

        db.run(
          `
            UPDATE agents
            SET published = 1,
                description = ?,
                category = ?,
                model = ?,
                system_prompt = ?,
                price_per_run = ?,
                card_gradient = ?,
                storage_hash = COALESCE(storage_hash, ?),
                manifest_uri = COALESCE(manifest_uri, ?),
                manifest_tx_hash = COALESCE(manifest_tx_hash, ?),
                knowledge_local_path = COALESCE(?, knowledge_local_path),
                knowledge_filename = COALESCE(?, knowledge_filename)
            WHERE id = ?;
          `,
          [
            agent.description,
            agent.category,
            agent.model,
            agent.systemPrompt,
            agent.pricePerRun,
            agent.cardGradient,
            `demo-${slug}-hash`,
            `0g://demo-${slug}-manifest`,
            `demo-${slug}-tx`,
            knowledgeLocalPath,
            "knowledgeFilename" in agent ? agent.knowledgeFilename ?? null : null,
            existing.id,
          ],
        );
        continue;
      }
      statement.run([
        agent.name,
        agent.description,
        agent.category,
        agent.model,
        agent.systemPrompt,
        `demo-${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-hash`,
        `0g://demo-${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-manifest`,
        `demo-${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-tx`,
        agent.pricePerRun,
        agent.cardGradient,
      ]);

      if ("knowledgeFilename" in agent && agent.knowledgeFilename && "knowledgeContent" in agent && agent.knowledgeContent) {
        const inserted = queryOne<{ id: number }>(db, "SELECT id FROM agents WHERE name = ?", [agent.name]);
        if (inserted) {
          const knowledgeDir = resolveDataPath("knowledge");
          await fs.mkdir(knowledgeDir, { recursive: true });
          const slug = slugifyAgentName(agent.name);
          const knowledgeLocalPath = path.join(knowledgeDir, `${slug}-${agent.knowledgeFilename}`);
          await fs.writeFile(knowledgeLocalPath, agent.knowledgeContent, "utf-8");
          db.run(
            `
              UPDATE agents
              SET knowledge_local_path = ?,
                  knowledge_filename = ?
              WHERE id = ?;
            `,
            [knowledgeLocalPath, agent.knowledgeFilename, inserted.id],
          );
        }
      }
    }
  } finally {
    statement.free();
  }

  db.run(`
    UPDATE agents
    SET model = 'openai/gpt-oss-120b:free';
  `);
}

async function cleanupLegacyAgents(db: Database): Promise<void> {
  const cleanupKey = "cleanup_demo_agents_v2";
  const existing = queryOne<{ value: string | null }>(db, "SELECT value FROM app_meta WHERE key = ?", [cleanupKey]);
  if (existing?.value === "done") {
    return;
  }

  const keepNames = DEMO_AGENTS.map((agent) => agent.name);
  const placeholders = keepNames.map(() => "?").join(", ");
  db.run(
    `
      DELETE FROM runs
      WHERE agent_id IN (
        SELECT id FROM agents WHERE name NOT IN (${placeholders})
      );
    `,
    keepNames,
  );
  db.run(
    `
      DELETE FROM agents
      WHERE name NOT IN (${placeholders});
    `,
    keepNames,
  );
  db.run(
    `
      INSERT OR REPLACE INTO app_meta (key, value)
      VALUES (?, 'done');
    `,
    [cleanupKey],
  );
}

async function assignDemoAgentsToPrimaryOwner(db: Database): Promise<void> {
  const owner = queryOne<{ id: number }>(
    db,
    "SELECT id FROM users WHERE lower(email) = lower(?)",
    [PRIMARY_DEMO_OWNER_EMAIL],
  );

  if (!owner) {
    return;
  }

  const keepNames = DEMO_AGENTS.map((agent) => agent.name);
  const placeholders = keepNames.map(() => "?").join(", ");
  db.run(
    `
      UPDATE agents
      SET creator_id = ?
      WHERE name IN (${placeholders});
    `,
    [owner.id, ...keepNames],
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

async function persistDatabase(db: Database): Promise<void> {
  const bytes = db.export();
  await fs.writeFile(DB_PATH, Buffer.from(bytes));
}

export async function withRead<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const db = await loadDatabase();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

export async function withWrite<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const operation = writeQueue.then(async () => {
    const db = await loadDatabase();
    try {
      const result = await fn(db);
      await persistDatabase(db);
      return result;
    } finally {
      db.close();
    }
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
