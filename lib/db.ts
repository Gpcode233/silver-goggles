import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env to enable Postgres-backed storage.");
}

const POOL_OPTS = {
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  ssl: "require" as const,
  prepare: false,
  idle_timeout: 30,
  // Neon free-tier compute scales to zero after ~5min of idle and the cold
  // start can take ~8-15s. Give it room.
  connect_timeout: 45,
  onnotice: () => {},
};

const sql = postgres(process.env.DATABASE_URL, POOL_OPTS);

// Optional read replica. Set DATABASE_REPLICA_URL to a Neon read-replica connection
// string and read-only queries (withRead) will be routed to it. Falls back to the
// primary connection when not set, so this is safe to leave empty in dev.
const replicaSql = process.env.DATABASE_REPLICA_URL
  ? postgres(process.env.DATABASE_REPLICA_URL, POOL_OPTS)
  : sql;

const PRIMARY_DEMO_OWNER_EMAIL = "godspowerojini8@gmail.com";
const PRIMARY_DEMO_OWNER_DISPLAY_NAME = "Godspower Ojini";

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

type SqlClient = postgres.Sql<{}> | postgres.TransactionSql<{}>;

export type Db = {
  run(query: string, params?: SqlParam[]): Promise<void>;
  queryOne<T>(query: string, params?: SqlParam[]): Promise<T | null>;
  queryAll<T>(query: string, params?: SqlParam[]): Promise<T[]>;
  getLastInsertId(): number;
};

export type SqlParam = number | string | Uint8Array | boolean | null;

function convertPlaceholders(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

function isInsert(query: string): boolean {
  return /^\s*INSERT\b/i.test(query);
}

function alreadyHasReturning(query: string): boolean {
  return /\bRETURNING\b/i.test(query);
}

function ensureReturningId(query: string): string {
  const trimmed = query.replace(/;\s*$/, "");
  return `${trimmed} RETURNING id`;
}

function makeDb(client: SqlClient): Db {
  let lastInsertId = 0;
  return {
    async run(query, params = []) {
      let q = convertPlaceholders(query);
      if (isInsert(q) && !alreadyHasReturning(q)) {
        q = ensureReturningId(q);
        const rows = (await client.unsafe(q, params as never[])) as Array<{ id?: number }>;
        const row = rows[0];
        if (row && typeof row.id === "number") {
          lastInsertId = row.id;
        }
        return;
      }
      await client.unsafe(q, params as never[]);
    },
    async queryOne<T>(query: string, params: SqlParam[] = []) {
      const rows = (await client.unsafe(convertPlaceholders(query), params as never[])) as T[];
      return rows[0] ?? null;
    },
    async queryAll<T>(query: string, params: SqlParam[] = []) {
      const rows = (await client.unsafe(convertPlaceholders(query), params as never[])) as T[];
      return rows;
    },
    getLastInsertId() {
      return lastInsertId;
    },
  };
}

export async function queryAll<T>(db: Db, query: string, params: SqlParam[] = []): Promise<T[]> {
  return db.queryAll<T>(query, params);
}

export async function queryOne<T>(db: Db, query: string, params: SqlParam[] = []): Promise<T | null> {
  return db.queryOne<T>(query, params);
}

export function getLastInsertId(db: Db): number {
  return db.getLastInsertId();
}

let initPromise: Promise<void> | null = null;

async function initialize(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL UNIQUE,
      credits DOUBLE PRECISION NOT NULL DEFAULT 100,
      email TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT,
      avatar_url TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'demo',
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
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
      creator_id INTEGER NOT NULL REFERENCES users(id),
      price_per_run DOUBLE PRECISION NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS runs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      agent_id INTEGER NOT NULL REFERENCES agents(id),
      input TEXT NOT NULL,
      output TEXT NOT NULL,
      cost DOUBLE PRECISION NOT NULL,
      compute_mode TEXT NOT NULL DEFAULT 'mock',
      run_uri TEXT,
      run_root_hash TEXT,
      run_tx_hash TEXT,
      archive_status TEXT NOT NULL DEFAULT 'pending',
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    );
  `;
  // Forward-compat: ensure new archive columns exist on databases created before
  // chat-run archival was introduced.
  await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS run_uri TEXT;`;
  await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS run_root_hash TEXT;`;
  await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS run_tx_hash TEXT;`;
  await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS archive_status TEXT NOT NULL DEFAULT 'pending';`;
  await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS archived_at TEXT;`;

  await sql`
    CREATE TABLE IF NOT EXISTS topup_orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      rail TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      credits DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider_reference TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
      completed_at TEXT
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS credit_ledger (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `;

  // Indexes that matter at scale.
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS inft_token_id INTEGER;`;
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS inft_contract_address TEXT;`;
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS inft_mint_tx_hash TEXT;`;
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS inft_owner_address TEXT;`;

  await sql`CREATE INDEX IF NOT EXISTS idx_agents_creator_id ON agents(creator_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agents_inft_token_id ON agents(inft_token_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agents_published ON agents(published);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_runs_user_id_created_at ON runs(user_id, created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_runs_agent_id_created_at ON runs(agent_id, created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id_created_at ON credit_ledger(user_id, created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_topup_orders_user_id ON topup_orders(user_id);`;

  // Apply model migrations for any agents on retired model ids.
  for (const [from, to] of MODEL_MIGRATIONS) {
    await sql`UPDATE agents SET model = ${to} WHERE model = ${from};`;
  }

  // Strip legacy fake demo proofs (left over from prior sqlite-era seeding).
  await sql`
    UPDATE agents
    SET storage_hash = NULL,
        manifest_uri = NULL,
        manifest_tx_hash = NULL,
        knowledge_uri = CASE WHEN knowledge_uri LIKE '0g://demo-%' THEN NULL ELSE knowledge_uri END,
        knowledge_tx_hash = CASE WHEN knowledge_tx_hash LIKE 'demo-%' THEN NULL ELSE knowledge_tx_hash END,
        published = 0
    WHERE
      (storage_hash IS NOT NULL AND storage_hash LIKE 'demo-%')
      OR (manifest_uri IS NOT NULL AND manifest_uri LIKE '0g://demo-%')
      OR (manifest_tx_hash IS NOT NULL AND manifest_tx_hash LIKE 'demo-%');
  `;

  // Fail-safe: if an agent is marked published but has no real proof, demote it.
  await sql`
    UPDATE agents
    SET published = 0
    WHERE published = 1
      AND (storage_hash IS NULL OR manifest_uri IS NULL OR manifest_tx_hash IS NULL);
  `;

  // Ensure the primary owner user exists and is reconciled.
  await sql`
    INSERT INTO users (id, wallet_address, credits, email, display_name, auth_provider, onboarding_completed)
    VALUES (
      1,
      ${process.env.DEMO_WALLET_ADDRESS ?? "0xDEMO_WALLET_ADDRESS"},
      100,
      ${PRIMARY_DEMO_OWNER_EMAIL},
      ${PRIMARY_DEMO_OWNER_DISPLAY_NAME},
      'demo',
      1
    )
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          display_name = EXCLUDED.display_name;
  `;
  // Keep the SERIAL sequence ahead of the manually inserted id=1.
  await sql`SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST(1, (SELECT COALESCE(MAX(id), 1) FROM users)));`;

  await seedDemoAgents();
}

const DEMO_AGENTS = [
  {
    name: "Viral Hook Architect",
    description: "Crafts viral hooks, CTAs, and launch copy in seconds.",
    category: "Marketing",
    model: "openai/gpt-oss-120b:free",
    pricePerRun: 0,
    cardGradient: "sunset",
    knowledgeFilename: "viral-hook-architect-skills.md",
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
    pricePerRun: 0.03,
    cardGradient: "ember",
    knowledgeFilename: "pull-request-reviewer-skills.md",
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
    pricePerRun: 0.02,
    cardGradient: "aurora",
    knowledgeFilename: "socratic-tutor-skills.md",
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

function slugifyAgentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function seedDemoAgents(): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { resolveDataPath } = await import("@/lib/data-dir");

  for (const agent of DEMO_AGENTS) {
    const slug = slugifyAgentName(agent.name);
    const knowledgeDir = resolveDataPath("knowledge");
    await fs.mkdir(knowledgeDir, { recursive: true });
    const knowledgeLocalPath = path.join(knowledgeDir, `${slug}-${agent.knowledgeFilename}`);
    await fs.writeFile(knowledgeLocalPath, agent.knowledgeContent, "utf-8");

    const existing = await sql<{ id: number }[]>`
      SELECT id FROM agents WHERE name = ${agent.name} LIMIT 1;
    `;
    if (existing.length > 0) {
      await sql`
        UPDATE agents
        SET description = ${agent.description},
            category = ${agent.category},
            model = ${agent.model},
            system_prompt = ${agent.systemPrompt},
            price_per_run = ${agent.pricePerRun},
            card_gradient = ${agent.cardGradient},
            knowledge_local_path = COALESCE(${knowledgeLocalPath}, knowledge_local_path),
            knowledge_filename = COALESCE(${agent.knowledgeFilename}, knowledge_filename),
            creator_id = 1
        WHERE id = ${existing[0].id};
      `;
      continue;
    }

    await sql`
      INSERT INTO agents (
        name, description, category, model, system_prompt,
        creator_id, price_per_run, published, card_gradient,
        knowledge_local_path, knowledge_filename
      )
      VALUES (
        ${agent.name}, ${agent.description}, ${agent.category}, ${agent.model}, ${agent.systemPrompt},
        1, ${agent.pricePerRun}, 0, ${agent.cardGradient},
        ${knowledgeLocalPath}, ${agent.knowledgeFilename}
      );
    `;
  }
}

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initialize().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export async function withRead<T>(fn: (db: Db) => Promise<T> | T): Promise<T> {
  await ensureInitialized();
  return fn(makeDb(replicaSql));
}

export async function withWrite<T>(fn: (db: Db) => Promise<T> | T): Promise<T> {
  await ensureInitialized();
  return sql.begin(async (tx) => fn(makeDb(tx))) as Promise<T>;
}

export const dbClient = sql;
