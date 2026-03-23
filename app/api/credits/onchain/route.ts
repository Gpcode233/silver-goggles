import { NextResponse } from "next/server";
import { createPublicClient, formatEther, http, isAddress, isAddressEqual, parseEther, type Hex } from "viem";

import { completeOnchainTopup, DEMO_USER_ID } from "@/lib/agent-service";
import { createOnchainTopupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const CHAIN_RPC_BY_ID: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  10: "https://mainnet.optimism.io",
  137: "https://polygon-rpc.com",
  8453: "https://mainnet.base.org",
  16601: "https://evmrpc-testnet.0g.ai",
  16602: "https://evmrpc-testnet.0g.ai",
  16661: "https://evmrpc.0g.ai",
  42161: "https://arb1.arbitrum.io/rpc",
};

function getTreasuryAddress() {
  return (
    process.env.TOPUP_TREASURY_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_TOPUP_TREASURY_ADDRESS?.trim()
  );
}

export async function POST(request: Request) {
  const parsed = createOnchainTopupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid onchain top-up payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const treasuryAddress = getTreasuryAddress();
  if (!treasuryAddress) {
    return NextResponse.json({ error: "Top-up treasury address is not configured" }, { status: 500 });
  }
  if (!isAddress(treasuryAddress)) {
    return NextResponse.json({ error: "Configured top-up treasury address is invalid" }, { status: 500 });
  }

  const rpcUrl = CHAIN_RPC_BY_ID[parsed.data.chainId];
  if (!rpcUrl) {
    return NextResponse.json({ error: "Unsupported chain for onchain top-up" }, { status: 400 });
  }

  try {
    const client = createPublicClient({
      transport: http(rpcUrl),
    });

    const [tx, receipt] = await Promise.all([
      client.getTransaction({ hash: parsed.data.txHash as Hex }),
      client.getTransactionReceipt({ hash: parsed.data.txHash as Hex }),
    ]);

    if (!tx.to || !isAddressEqual(tx.to, treasuryAddress)) {
      return NextResponse.json({ error: "Transaction does not pay the treasury address" }, { status: 400 });
    }

    if (!isAddressEqual(tx.from, parsed.data.fromAddress as `0x${string}`)) {
      return NextResponse.json({ error: "Transaction sender does not match connected wallet" }, { status: 400 });
    }

    if (Number(tx.chainId) !== parsed.data.chainId) {
      return NextResponse.json({ error: "Transaction chain id mismatch" }, { status: 400 });
    }

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction failed onchain" }, { status: 400 });
    }

    if (tx.value <= 0n) {
      return NextResponse.json({ error: "Transaction has zero value" }, { status: 400 });
    }

    if (parsed.data.expectedAmount) {
      const expected = parseEther(parsed.data.expectedAmount);
      if (tx.value < expected) {
        return NextResponse.json({ error: "Transaction value is below requested top-up amount" }, { status: 400 });
      }
    }

    const amount = Number(formatEther(tx.value));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid transaction value" }, { status: 400 });
    }

    const completed = await completeOnchainTopup({
      userId: DEMO_USER_ID,
      txHash: parsed.data.txHash,
      fromAddress: tx.from,
      chainId: parsed.data.chainId,
      currency: parsed.data.currency,
      amount,
    });

    return NextResponse.json({
      order: completed.order,
      credited: amount,
      txHash: parsed.data.txHash,
      idempotent: !completed.created,
      remainingCredits: completed.user.credits,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify onchain top-up" },
      { status: 500 },
    );
  }
}
