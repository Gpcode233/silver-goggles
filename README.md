# Ajently (MVP v1)

Ajently is an "App Store for AI agents" where creators can publish agents, users can run them through decentralized 0G infrastructure, and buyers can top up credits through Interswitch Web Checkout.

## MVP Features

- Create Agent: name, description, category, system prompt, price, optional knowledge file.
- Publish Agent: generates manifest and uploads manifest/knowledge to 0G Storage with transaction proof.
- Storage Proofs: publish responses include `rootHash` + `transactionHash` and retrieval can be verified per agent.
- Explore Agents: search + category filter marketplace.
- Run Agent: chat UI with credits deduction and run logs.
- Credits Profile: shows wallet + credits + created agents.
- Interswitch Top-Up: buy Ajently credits in NGN using cards, bank transfer, USSD, and other supported payment methods.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- SQLite (via `sql.js`, persisted at `data/Ajently.sqlite`)
- Interswitch Web Checkout + server-side transaction requery
- 0G integrations:
  - Storage: `@0gfoundation/0g-ts-sdk`
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

- Storage is strict by default for publish flows:
  - `ZERO_G_STORAGE_MODE=real`
  - `ZERO_G_STORAGE_FALLBACK_TO_MOCK=false`
- OpenRouter fallback:
  - Set `OPENROUTER_API_KEY` to get real chat responses even when `ZERO_G_COMPUTE_MODE` is not `real`.
  - Optional: set `OPENROUTER_DEFAULT_MODEL` for `openrouter/free` or image-only model selections.
- Onchain credit top-up:
  - Set `NEXT_PUBLIC_TOPUP_TREASURY_ADDRESS` so wallet transfers can be verified and credited in-app.
  - Optional: set `TOPUP_TREASURY_ADDRESS` for server-only override.
- Interswitch fiat credit top-up:
  - Set `INTERSWITCH_ENV=sandbox`
  - Set `INTERSWITCH_MERCHANT_CODE`
  - Set `INTERSWITCH_PAY_ITEM_ID`
  - Optional: set `INTERSWITCH_DEFAULT_CUSTOMER_EMAIL`
  - Optional: set `INTERSWITCH_WEBHOOK_SECRET` if you enable Interswitch webhooks
- To use real 0G:
  - Set `ZERO_G_STORAGE_MODE=real`
  - Set `ZERO_G_COMPUTE_MODE=real` (optional if only storage is required)
  - Set `ZERO_G_PRIVATE_KEY`
  - Keep `ZERO_G_EVM_RPC` and `ZERO_G_STORAGE_INDEXER_RPC` configured
  - Keep `ZERO_G_STORAGE_FALLBACK_TO_MOCK=false` for judge-facing deployments
  - Optionally set `ZERO_G_COMPUTE_PROVIDER`

## 0G Storage Compliance (Hackathon)

This project is implemented to satisfy the 0G Storage requirement with both upload and retrieval proof:

1. Upload proof on publish:
   - Every marketplace-visible agent must have `manifest_uri`, `storage_hash`, and `manifest_tx_hash`.
   - API responses return `uploadProof.manifest.rootHash` + `uploadProof.manifest.transactionHash`.
2. Retrieval proof:
   - `GET /api/agents/:id/storage` downloads manifest and knowledge from 0G using the stored URI/root hash.
   - The response includes retrieved byte sizes, root hashes, tx hashes, and hash-match checks.
3. Marketplace gating:
   - Only agents with full storage proof are listed on `/`.
4. No silent mock fallback for publish:
   - Publish fails if real 0G storage is not configured or no tx proof is returned.

Official references:
- 0G docs home: https://docs.0g.ai/
- Storage overview and SDK docs: https://docs.0g.ai/build-with-0g/storage

## Key Routes

- `/` marketplace
- `/create` create + publish form
- `/credits` credit top-up, ledger, and webhook simulation
- `/credits/confirm` return page that requeries Interswitch before credits are issued
- `/agents/[id]` details + publish status + runs
- `/agents/[id]/chat` run agent chat
- `/profile` credits and creator profile

## API Endpoints

- `GET /api/agents`
- `POST /api/agents`
- `POST /api/agents/sync-storage` (publish all agents missing 0G storage proof)
- `GET /api/agents/:id`
- `POST /api/agents/:id/publish`
- `GET /api/agents/:id/storage` (retrieval proof from 0G storage)
- `POST /api/agents/:id/run`
- `GET /api/credits`
- `POST /api/credits`
- `POST /api/credits/:id/confirm` (server-side Interswitch requery and reconciliation)
- `POST /api/credits/onchain` (verify tx and credit from native-token top-up)
- `POST /api/credits/:id/simulate` (demo webhook reconciliation)
- `POST /api/webhooks/payments`
- `GET /api/profile`
- `GET /api/runs`

## Storage Proof Demo Flow

1. Create and publish an agent (or publish an existing draft).
2. Capture the returned `uploadProof.manifest.rootHash` and `uploadProof.manifest.transactionHash`.
3. Open the agent detail page and click `Verify Storage Retrieval`.
4. The app calls `GET /api/agents/:id/storage`, downloads from storage, and returns proof metadata.

## Interswitch Flow

1. Open `/credits` and choose the `Interswitch` rail.
2. Enter a naira amount and submit the hosted checkout form to Interswitch.
3. After payment, Interswitch redirects the user to `/credits/confirm`.
4. Ajently makes a server-side requery to `gettransaction.json` and only credits the account after a successful response and amount match.
5. Optional: configure Interswitch webhooks to reconcile completed payments asynchronously through `/api/webhooks/payments`.
