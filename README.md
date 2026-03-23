# Ajently (MVP v1)

Ajently is an "App Store for AI agents" where creators can publish agents and users can run them through decentralized 0G infrastructure.

## MVP Features

- Create Agent: name, description, category, system prompt, price, optional knowledge file.
- Publish Agent: generates manifest and uploads manifest/knowledge to 0G Storage (or mock mode).
- Storage Proofs: publish responses include `rootHash` + `transactionHash` and retrieval can be verified per agent.
- Explore Agents: search + category filter marketplace.
- Run Agent: chat UI with credits deduction and run logs.
- Credits Profile: shows wallet + credits + created agents.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- SQLite (via `sql.js`, persisted at `data/Ajently.sqlite`)
- 0G integrations:
  - Storage: `@0glabs/0g-ts-sdk`
  - Compute: `@0glabs/0g-serving-broker`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Run development server:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## 0G Modes

- Default is mock mode:
  - `ZERO_G_STORAGE_MODE=mock`
  - `ZERO_G_COMPUTE_MODE=mock`
- To use real 0G:
  - Set both modes to `real`
  - Set `ZERO_G_PRIVATE_KEY`
  - Keep `ZERO_G_EVM_RPC` and `ZERO_G_STORAGE_INDEXER_RPC` configured
  - Optionally set `ZERO_G_COMPUTE_PROVIDER`

## Key Routes

- `/` marketplace
- `/create` create + publish form
- `/agents/[id]` details + publish status + runs
- `/agents/[id]/chat` run agent chat
- `/profile` credits and creator profile

## API Endpoints

- `GET /api/agents`
- `POST /api/agents`
- `GET /api/agents/:id`
- `POST /api/agents/:id/publish`
- `GET /api/agents/:id/storage` (retrieval proof from 0G storage)
- `POST /api/agents/:id/run`
- `GET /api/profile`
- `GET /api/runs`

## Storage Proof Demo Flow

1. Create and publish an agent (or publish an existing draft).
2. Capture the returned `uploadProof.manifest.rootHash` and `uploadProof.manifest.transactionHash`.
3. Open the agent detail page and click `Verify Storage Retrieval`.
4. The app calls `GET /api/agents/:id/storage`, downloads from storage, and returns proof metadata.
