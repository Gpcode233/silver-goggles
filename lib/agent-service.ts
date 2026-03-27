import fs from "node:fs/promises";
import crypto from "node:crypto";

import { getLastInsertId, queryAll, queryOne, withRead, withWrite } from "@/lib/db";
import {
  isInterswitchPendingCode,
  isInterswitchSuccessCode,
  requeryInterswitchTransaction,
} from "@/lib/interswitch";
import { AGENT_MODELS } from "@/lib/types";
import type {
  AgentCardGradient,
  AgentModel,
  AgentRecord,
  CreditLedgerKind,
  CreditLedgerRecord,
  RunRecord,
  TopupOrderRecord,
  TopupRail,
  TopupStatus,
  UserRecord,
} from "@/lib/types";

export const DEMO_USER_ID = 1;

type AgentRow = {
  id: number;
  name: string;
  description: string;
  category: string;
  model: AgentModel;
  system_prompt: string;
  price_per_run: number;
  creator_id: number;
  storage_hash: string | null;
  manifest_uri: string | null;
  manifest_tx_hash: string | null;
  knowledge_uri: string | null;
  knowledge_tx_hash: string | null;
  card_image_data_url: string | null;
  card_gradient: AgentCardGradient;
  knowledge_local_path: string | null;
  knowledge_filename: string | null;
  published: number;
  created_at: string;
};

type RunRow = {
  id: number;
  user_id: number;
  agent_id: number;
  input: string;
  output: string;
  cost: number;
  compute_mode: string;
  created_at: string;
};

type UserRow = {
  id: number;
  wallet_address: string;
  credits: number;
  email: string | null;
  password_hash: string | null;
  display_name: string | null;
  avatar_url: string | null;
  auth_provider: "demo" | "email" | "google" | "wallet";
  onboarding_completed: number;
};

type CreditLedgerRow = {
  id: number;
  user_id: number;
  kind: CreditLedgerKind;
  amount: number;
  reference_type: string | null;
  reference_id: number | null;
  note: string | null;
  created_at: string;
};

type TopupOrderRow = {
  id: number;
  user_id: number;
  rail: TopupRail;
  currency: string;
  amount: number;
  credits: number;
  status: TopupStatus;
  provider_reference: string;
  created_at: string;
  completed_at: string | null;
};

function mapAgent(row: AgentRow): AgentRecord {
  const model = AGENT_MODELS.includes(row.model) ? row.model : AGENT_MODELS[0];

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    model,
    systemPrompt: row.system_prompt,
    pricePerRun: Number(row.price_per_run),
    creatorId: row.creator_id,
    storageHash: row.storage_hash,
    manifestUri: row.manifest_uri,
    manifestTxHash: row.manifest_tx_hash,
    knowledgeUri: row.knowledge_uri,
    knowledgeTxHash: row.knowledge_tx_hash,
    cardImageDataUrl: row.card_image_data_url,
    cardGradient: row.card_gradient,
    knowledgeLocalPath: row.knowledge_local_path,
    knowledgeFilename: row.knowledge_filename,
    published: row.published === 1,
    createdAt: row.created_at,
  };
}

function mapRun(row: RunRow): RunRecord {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    input: row.input,
    output: row.output,
    cost: Number(row.cost),
    computeMode: row.compute_mode,
    createdAt: row.created_at,
  };
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    credits: Number(row.credits),
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    authProvider: row.auth_provider,
    onboardingCompleted: row.onboarding_completed === 1,
  };
}

function mapCreditLedger(row: CreditLedgerRow): CreditLedgerRecord {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    amount: Number(row.amount),
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapTopupOrder(row: TopupOrderRow): TopupOrderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    rail: row.rail,
    currency: row.currency,
    amount: Number(row.amount),
    credits: Number(row.credits),
    status: row.status,
    providerReference: row.provider_reference,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function listAgents(options: {
  search?: string;
  category?: string;
  includeDrafts?: boolean;
} = {}): Promise<AgentRecord[]> {
  const where: string[] = [];
  const params: Array<number | string | Uint8Array | null> = [];

  if (!options.includeDrafts) {
    where.push("published = 1");
  }

  if (options.search?.trim()) {
    where.push("(name LIKE ? OR description LIKE ?)");
    const q = `%${options.search.trim()}%`;
    params.push(q, q);
  }

  if (options.category?.trim()) {
    where.push("category = ?");
    params.push(options.category.trim());
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return withRead((db) => {
    const rows = queryAll<AgentRow>(
      db,
      `
        SELECT *
        FROM agents
        ${whereSql}
        ORDER BY created_at DESC;
      `,
      params,
    );
    return rows.map(mapAgent);
  });
}

export async function listAgentsByCreator(creatorId: number): Promise<AgentRecord[]> {
  return withRead((db) => {
    const rows = queryAll<AgentRow>(
      db,
      `
        SELECT *
        FROM agents
        WHERE creator_id = ?
        ORDER BY created_at DESC;
      `,
      [creatorId],
    );
    return rows.map(mapAgent);
  });
}

export async function getAgentById(id: number): Promise<AgentRecord | null> {
  return withRead((db) => {
    const row = queryOne<AgentRow>(db, "SELECT * FROM agents WHERE id = ?", [id]);
    return row ? mapAgent(row) : null;
  });
}

export async function createAgent(input: {
  name: string;
  description: string;
  category: string;
  model: AgentModel;
  systemPrompt: string;
  pricePerRun: number;
  cardImageDataUrl: string | null;
  cardGradient: AgentCardGradient;
  published?: boolean;
  creatorId?: number;
}): Promise<AgentRecord> {
  return withWrite((db) => {
    db.run(
      `
        INSERT INTO agents (
          name,
          description,
          category,
          model,
          system_prompt,
          card_image_data_url,
          card_gradient,
          creator_id,
          price_per_run,
          published
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        input.name,
        input.description,
        input.category,
        input.model,
        input.systemPrompt,
        input.cardImageDataUrl,
        input.cardGradient,
        input.creatorId ?? DEMO_USER_ID,
        input.pricePerRun,
        input.published ? 1 : 0,
      ],
    );

    const id = getLastInsertId(db);
    const row = queryOne<AgentRow>(db, "SELECT * FROM agents WHERE id = ?", [id]);
    if (!row) {
      throw new Error("Failed to create agent");
    }
    return mapAgent(row);
  });
}

export async function updateAgent(input: {
  id: number;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  cardImageDataUrl: string | null;
  cardGradient: AgentCardGradient;
}): Promise<AgentRecord> {
  return withWrite((db) => {
    db.run(
      `
        UPDATE agents
        SET name = ?,
            description = ?,
            category = ?,
            system_prompt = ?,
            card_image_data_url = ?,
            card_gradient = ?
        WHERE id = ?;
      `,
      [
        input.name,
        input.description,
        input.category,
        input.systemPrompt,
        input.cardImageDataUrl,
        input.cardGradient,
        input.id,
      ],
    );

    const row = queryOne<AgentRow>(db, "SELECT * FROM agents WHERE id = ?", [input.id]);
    if (!row) {
      throw new Error("Failed to update agent");
    }
    return mapAgent(row);
  });
}

export async function attachKnowledgeFile(
  agentId: number,
  knowledgeLocalPath: string,
  knowledgeFilename: string,
): Promise<void> {
  await withWrite((db) => {
    db.run(
      `
        UPDATE agents
        SET knowledge_local_path = ?,
            knowledge_filename = ?
        WHERE id = ?;
      `,
      [knowledgeLocalPath, knowledgeFilename, agentId],
    );
  });
}

export async function applyPublishResult(params: {
  agentId: number;
  storageHash: string;
  manifestUri: string;
  manifestTxHash: string | null;
  knowledgeUri: string | null;
  knowledgeTxHash: string | null;
}): Promise<AgentRecord> {
  return withWrite((db) => {
    db.run(
      `
        UPDATE agents
        SET storage_hash = ?,
            manifest_uri = ?,
            manifest_tx_hash = ?,
            knowledge_uri = ?,
            knowledge_tx_hash = ?,
            published = 1
        WHERE id = ?;
      `,
      [
        params.storageHash,
        params.manifestUri,
        params.manifestTxHash,
        params.knowledgeUri,
        params.knowledgeTxHash,
        params.agentId,
      ],
    );

    const row = queryOne<AgentRow>(db, "SELECT * FROM agents WHERE id = ?", [params.agentId]);
    if (!row) {
      throw new Error("Agent not found after publish");
    }

    return mapAgent(row);
  });
}

export async function getUserById(userId: number): Promise<UserRecord | null> {
  return withRead((db) => {
    const row = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [userId]);
    return row ? mapUser(row) : null;
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  return withRead((db) => {
    const row = queryOne<UserRow>(db, "SELECT * FROM users WHERE lower(email) = ?", [normalizeEmail(email)]);
    return row ? mapUser(row) : null;
  });
}

export async function getOrCreateGoogleUser(): Promise<UserRecord> {
  return withWrite((db) => {
    const seedEmail = `google-${crypto.randomUUID()}@ajently.local`;
    db.run(
      `
        INSERT INTO users (wallet_address, credits, email, auth_provider, onboarding_completed)
        VALUES (?, 100, ?, 'google', 0);
      `,
      [`wallet_google_${crypto.randomUUID()}`, seedEmail],
    );
    const row = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [getLastInsertId(db)]);
    if (!row) throw new Error("Failed to create Google user");
    return mapUser(row);
  });
}

export async function upsertGoogleUser(params: {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}): Promise<UserRecord> {
  return withWrite((db) => {
    const email = normalizeEmail(params.email);
    const existing = queryOne<UserRow>(db, "SELECT * FROM users WHERE lower(email) = ?", [email]);
    if (existing) {
      db.run(
        `
          UPDATE users
          SET display_name = COALESCE(?, display_name),
              avatar_url = COALESCE(?, avatar_url),
              auth_provider = 'google'
          WHERE id = ?;
        `,
        [params.displayName, params.avatarUrl, existing.id],
      );
      const updated = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [existing.id]);
      if (!updated) throw new Error("Failed to update Google user");
      return mapUser(updated);
    }

    db.run(
      `
        INSERT INTO users (wallet_address, credits, email, display_name, avatar_url, auth_provider, onboarding_completed)
        VALUES (?, 100, ?, ?, ?, 'google', ?);
      `,
      [
        `wallet_google_${crypto.randomUUID()}`,
        email,
        params.displayName,
        params.avatarUrl,
        params.displayName && params.avatarUrl ? 1 : 0,
      ],
    );
    const row = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [getLastInsertId(db)]);
    if (!row) throw new Error("Failed to create Google user");
    return mapUser(row);
  });
}

export async function getOrCreateWalletUser(walletAddress: string): Promise<UserRecord> {
  return withWrite((db) => {
    const existing = queryOne<UserRow>(db, "SELECT * FROM users WHERE wallet_address = ?", [walletAddress]);
    if (existing) {
      return mapUser(existing);
    }
    db.run(
      `
        INSERT INTO users (wallet_address, credits, auth_provider, onboarding_completed)
        VALUES (?, 100, 'wallet', 0);
      `,
      [walletAddress],
    );
    const row = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [getLastInsertId(db)]);
    if (!row) throw new Error("Failed to create wallet user");
    return mapUser(row);
  });
}

export async function registerEmailUser(params: {
  email: string;
  password: string;
}): Promise<UserRecord> {
  return withWrite((db) => {
    const email = normalizeEmail(params.email);
    const existing = queryOne<UserRow>(db, "SELECT * FROM users WHERE lower(email) = ?", [email]);
    if (existing) {
      throw new Error("EMAIL_EXISTS");
    }
    db.run(
      `
        INSERT INTO users (wallet_address, credits, email, password_hash, auth_provider, onboarding_completed)
        VALUES (?, 100, ?, ?, 'email', 0);
      `,
      [`wallet_email_${crypto.randomUUID()}`, email, hashPassword(params.password)],
    );
    const row = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [getLastInsertId(db)]);
    if (!row) throw new Error("Failed to create email user");
    return mapUser(row);
  });
}

export async function authenticateEmailUser(params: {
  email: string;
  password: string;
}): Promise<UserRecord> {
  return withRead((db) => {
    const row = queryOne<UserRow>(db, "SELECT * FROM users WHERE lower(email) = ?", [normalizeEmail(params.email)]);
    if (!row || !row.password_hash || row.password_hash !== hashPassword(params.password)) {
      throw new Error("INVALID_CREDENTIALS");
    }
    return mapUser(row);
  });
}

export async function completeUserOnboarding(params: {
  userId: number;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}): Promise<UserRecord> {
  return withWrite((db) => {
    db.run(
      `
        UPDATE users
        SET display_name = ?,
            email = COALESCE(?, email),
            avatar_url = ?,
            onboarding_completed = 1
        WHERE id = ?;
      `,
      [params.displayName, params.email ? normalizeEmail(params.email) : null, params.avatarUrl, params.userId],
    );
    const row = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [params.userId]);
    if (!row) throw new Error("User not found");
    return mapUser(row);
  });
}

export async function listRunsForAgent(agentId: number): Promise<RunRecord[]> {
  return withRead((db) => {
    const rows = queryAll<RunRow>(
      db,
      `
        SELECT *
        FROM runs
        WHERE agent_id = ?
        ORDER BY created_at DESC
        LIMIT 25;
      `,
      [agentId],
    );
    return rows.map(mapRun);
  });
}

export async function listRecentRuns(limit = 40): Promise<RunRecord[]> {
  return withRead((db) => {
    const rows = queryAll<RunRow>(
      db,
      `
        SELECT *
        FROM runs
        ORDER BY created_at DESC
        LIMIT ?;
      `,
      [limit],
    );
    return rows.map(mapRun);
  });
}

export async function listRunsForUser(userId: number, limit = 20): Promise<RunRecord[]> {
  return withRead((db) => {
    const rows = queryAll<RunRow>(
      db,
      `
        SELECT *
        FROM runs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?;
      `,
      [userId, limit],
    );
    return rows.map(mapRun);
  });
}

export async function runAgentForUser(params: {
  userId: number;
  agentId: number;
  input: string;
  output: string;
  computeMode: string;
}): Promise<{ run: RunRecord; user: UserRecord }> {
  return withWrite((db) => {
    const user = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [params.userId]);
    if (!user) {
      throw new Error("User not found");
    }

    const agent = queryOne<AgentRow>(db, "SELECT * FROM agents WHERE id = ?", [params.agentId]);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const price = Number(agent.price_per_run);
    const credits = Number(user.credits);
    if (credits < price) {
      throw new Error("INSUFFICIENT_CREDITS");
    }

    db.run("UPDATE users SET credits = credits - ? WHERE id = ?", [price, params.userId]);
    db.run(
      `
        INSERT INTO runs (user_id, agent_id, input, output, cost, compute_mode)
        VALUES (?, ?, ?, ?, ?, ?);
      `,
      [params.userId, params.agentId, params.input, params.output, price, params.computeMode],
    );

    const runId = getLastInsertId(db);
    db.run(
      `
        INSERT INTO credit_ledger (user_id, kind, amount, reference_type, reference_id, note)
        VALUES (?, 'run_debit', ?, 'run', ?, ?);
      `,
      [params.userId, -price, runId, `Agent ${params.agentId} run`],
    );

    const runRow = queryOne<RunRow>(db, "SELECT * FROM runs WHERE id = ?", [runId]);
    const userRow = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [params.userId]);

    if (!runRow || !userRow) {
      throw new Error("Failed to persist run");
    }

    return { run: mapRun(runRow), user: mapUser(userRow) };
  });
}

export async function listCreditLedgerForUser(userId: number, limit = 50): Promise<CreditLedgerRecord[]> {
  return withRead((db) => {
    const rows = queryAll<CreditLedgerRow>(
      db,
      `
        SELECT *
        FROM credit_ledger
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?;
      `,
      [userId, limit],
    );
    return rows.map(mapCreditLedger);
  });
}

export async function listTopupOrdersForUser(userId: number, limit = 50): Promise<TopupOrderRecord[]> {
  return withRead((db) => {
    const rows = queryAll<TopupOrderRow>(
      db,
      `
        SELECT *
        FROM topup_orders
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?;
      `,
      [userId, limit],
    );
    return rows.map(mapTopupOrder);
  });
}

export async function createTopupOrder(params: {
  userId: number;
  rail: TopupRail;
  currency: string;
  amount: number;
}): Promise<TopupOrderRecord> {
  return withWrite((db) => {
    const providerReference = `topup_${crypto.randomUUID()}`;
    db.run(
      `
        INSERT INTO topup_orders (user_id, rail, currency, amount, credits, status, provider_reference)
        VALUES (?, ?, ?, ?, ?, 'pending', ?);
      `,
      [params.userId, params.rail, params.currency, params.amount, params.amount, providerReference],
    );

    const id = getLastInsertId(db);
    const row = queryOne<TopupOrderRow>(db, "SELECT * FROM topup_orders WHERE id = ?", [id]);
    if (!row) {
      throw new Error("Failed to create top-up order");
    }
    return mapTopupOrder(row);
  });
}

export async function completeOnchainTopup(params: {
  userId: number;
  txHash: string;
  fromAddress: string;
  chainId: number;
  currency: string;
  amount: number;
}): Promise<{ order: TopupOrderRecord; user: UserRecord; created: boolean }> {
  return withWrite((db) => {
    const user = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [params.userId]);
    if (!user) {
      throw new Error("User not found");
    }

    const existing = queryOne<TopupOrderRow>(
      db,
      "SELECT * FROM topup_orders WHERE provider_reference = ?",
      [params.txHash],
    );

    if (existing) {
      return {
        order: mapTopupOrder(existing),
        user: mapUser(user),
        created: false,
      };
    }

    db.run(
      `
        INSERT INTO topup_orders (
          user_id,
          rail,
          currency,
          amount,
          credits,
          status,
          provider_reference,
          completed_at
        )
        VALUES (?, 'native', ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP);
      `,
      [params.userId, params.currency, params.amount, params.amount, params.txHash],
    );

    const topupId = getLastInsertId(db);

    db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [params.amount, params.userId]);
    db.run(
      `
        INSERT INTO credit_ledger (user_id, kind, amount, reference_type, reference_id, note)
        VALUES (?, 'topup', ?, 'topup_order', ?, ?);
      `,
      [
        params.userId,
        params.amount,
        topupId,
        `Onchain top-up (${params.currency}) on chain ${params.chainId} from ${params.fromAddress}`,
      ],
    );

    const order = queryOne<TopupOrderRow>(db, "SELECT * FROM topup_orders WHERE id = ?", [topupId]);
    const updatedUser = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [params.userId]);

    if (!order || !updatedUser) {
      throw new Error("Failed to persist onchain top-up");
    }

    return {
      order: mapTopupOrder(order),
      user: mapUser(updatedUser),
      created: true,
    };
  });
}

export async function getTopupOrderById(id: number): Promise<TopupOrderRecord | null> {
  return withRead((db) => {
    const row = queryOne<TopupOrderRow>(db, "SELECT * FROM topup_orders WHERE id = ?", [id]);
    return row ? mapTopupOrder(row) : null;
  });
}

export async function reconcileTopupOrder(params: {
  providerReference: string;
  status: "completed" | "failed";
  note?: string;
}): Promise<TopupOrderRecord> {
  return withWrite((db) => {
    const order = queryOne<TopupOrderRow>(
      db,
      "SELECT * FROM topup_orders WHERE provider_reference = ?",
      [params.providerReference],
    );
    if (!order) {
      throw new Error("Top-up order not found");
    }

    if (order.status === "completed" || order.status === "failed") {
      return mapTopupOrder(order);
    }

    if (params.status === "completed") {
      db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [order.credits, order.user_id]);
      db.run(
        `
          INSERT INTO credit_ledger (user_id, kind, amount, reference_type, reference_id, note)
          VALUES (?, 'topup', ?, 'topup_order', ?, ?);
        `,
        [order.user_id, order.credits, order.id, params.note ?? `${order.rail} top-up`],
      );
      db.run(
        `
          UPDATE topup_orders
          SET status = 'completed',
              completed_at = CURRENT_TIMESTAMP
          WHERE id = ?;
        `,
        [order.id],
      );
    } else {
      db.run(
        `
          UPDATE topup_orders
          SET status = 'failed',
              completed_at = CURRENT_TIMESTAMP
          WHERE id = ?;
        `,
        [order.id],
      );
    }

    const updated = queryOne<TopupOrderRow>(db, "SELECT * FROM topup_orders WHERE id = ?", [order.id]);
    if (!updated) {
      throw new Error("Top-up order missing after reconciliation");
    }
    return mapTopupOrder(updated);
  });
}

export async function confirmTopupOrderWithInterswitch(topupId: number): Promise<{
  order: TopupOrderRecord;
  state: "completed" | "pending" | "failed";
  gateway: {
    code: string | null;
    description: string | null;
    paymentReference: string | null;
    amountMinor: number | null;
  };
}> {
  const order = await getTopupOrderById(topupId);
  if (!order) {
    throw new Error("Top-up order not found");
  }

  if (order.rail !== "fiat") {
    throw new Error("Only Interswitch-backed fiat top-ups can be confirmed here.");
  }

  if (order.status === "completed") {
    return {
      order,
      state: "completed",
      gateway: {
        code: "00",
        description: "Already reconciled",
        paymentReference: null,
        amountMinor: null,
      },
    };
  }

  const requery = await requeryInterswitchTransaction({
    txnRef: order.providerReference,
    amount: order.amount,
  });

  const responseCode = requery.ResponseCode ?? null;
  const responseDescription = requery.ResponseDescription ?? null;
  const amountMinor = typeof requery.Amount === "number" ? requery.Amount : null;
  const expectedMinor = Math.round(order.amount * 100);

  if (isInterswitchSuccessCode(responseCode)) {
    if (amountMinor !== expectedMinor) {
      throw new Error(
        `Interswitch amount mismatch. Expected ${expectedMinor}, received ${amountMinor ?? "unknown"}.`,
      );
    }

    const reconciled = await reconcileTopupOrder({
      providerReference: order.providerReference,
      status: "completed",
      note:
        requery.PaymentReference?.trim()
          ? `Interswitch payment confirmed (${requery.PaymentReference.trim()})`
          : "Interswitch payment confirmed",
    });

    return {
      order: reconciled,
      state: "completed",
      gateway: {
        code: responseCode,
        description: responseDescription,
        paymentReference: requery.PaymentReference ?? null,
        amountMinor,
      },
    };
  }

  if (!isInterswitchPendingCode(responseCode)) {
    const reconciled = await reconcileTopupOrder({
      providerReference: order.providerReference,
      status: "failed",
      note: responseDescription ?? "Interswitch payment failed",
    });

    return {
      order: reconciled,
      state: "failed",
      gateway: {
        code: responseCode,
        description: responseDescription,
        paymentReference: requery.PaymentReference ?? null,
        amountMinor,
      },
    };
  }

  return {
    order,
    state: "pending",
    gateway: {
      code: responseCode,
      description: responseDescription,
      paymentReference: requery.PaymentReference ?? null,
      amountMinor,
    },
  };
}

export async function getCreditStats(userId: number): Promise<{
  remaining: number;
  used: number;
  toppedUp: number;
}> {
  return withRead((db) => {
    const user = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) {
      throw new Error("User not found");
    }

    const usedRow = queryOne<{ total: number | null }>(
      db,
      "SELECT SUM(cost) AS total FROM runs WHERE user_id = ?",
      [userId],
    );
    const toppedUpRow = queryOne<{ total: number | null }>(
      db,
      "SELECT SUM(amount) AS total FROM credit_ledger WHERE user_id = ? AND kind = 'topup'",
      [userId],
    );

    return {
      remaining: Number(user.credits),
      used: Number(usedRow?.total ?? 0),
      toppedUp: Number(toppedUpRow?.total ?? 0),
    };
  });
}

export async function readKnowledgeFromLocal(agent: AgentRecord): Promise<string> {
  if (!agent.knowledgeLocalPath) {
    return "";
  }
  const content = await fs.readFile(agent.knowledgeLocalPath);
  return content.toString("utf-8");
}
