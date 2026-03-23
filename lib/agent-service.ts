import fs from "node:fs/promises";

import { getLastInsertId, queryAll, queryOne, withRead, withWrite } from "@/lib/db";
import type { AgentRecord, RunRecord, UserRecord } from "@/lib/types";

export const DEMO_USER_ID = 1;

type AgentRow = {
  id: number;
  name: string;
  description: string;
  category: string;
  system_prompt: string;
  price_per_run: number;
  creator_id: number;
  storage_hash: string | null;
  manifest_uri: string | null;
  manifest_tx_hash: string | null;
  knowledge_uri: string | null;
  knowledge_tx_hash: string | null;
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
};

function mapAgent(row: AgentRow): AgentRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    systemPrompt: row.system_prompt,
    pricePerRun: Number(row.price_per_run),
    creatorId: row.creator_id,
    storageHash: row.storage_hash,
    manifestUri: row.manifest_uri,
    manifestTxHash: row.manifest_tx_hash,
    knowledgeUri: row.knowledge_uri,
    knowledgeTxHash: row.knowledge_tx_hash,
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
  systemPrompt: string;
  pricePerRun: number;
  creatorId?: number;
}): Promise<AgentRecord> {
  return withWrite((db) => {
    db.run(
      `
        INSERT INTO agents (
          name,
          description,
          category,
          system_prompt,
          creator_id,
          price_per_run
        )
        VALUES (?, ?, ?, ?, ?, ?);
      `,
      [
        input.name,
        input.description,
        input.category,
        input.systemPrompt,
        input.creatorId ?? DEMO_USER_ID,
        input.pricePerRun,
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
    const runRow = queryOne<RunRow>(db, "SELECT * FROM runs WHERE id = ?", [runId]);
    const userRow = queryOne<UserRow>(db, "SELECT * FROM users WHERE id = ?", [params.userId]);

    if (!runRow || !userRow) {
      throw new Error("Failed to persist run");
    }

    return { run: mapRun(runRow), user: mapUser(userRow) };
  });
}

export async function readKnowledgeFromLocal(agent: AgentRecord): Promise<string> {
  if (!agent.knowledgeLocalPath) {
    return "";
  }
  const content = await fs.readFile(agent.knowledgeLocalPath);
  return content.toString("utf-8");
}
