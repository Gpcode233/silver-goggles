import crypto from "node:crypto";

// Paystack API client. Uses test or live keys based on PAYSTACK_SECRET_KEY
// (sk_test_* vs sk_live_*). See https://paystack.com/docs/api/

const PAYSTACK_BASE_URL = "https://api.paystack.co";

// Paystack expects amounts in the smallest currency subunit (kobo for NGN,
// pesewas for GHS, cents for USD, etc.). Subunit factor per supported currency.
const SUBUNIT_FACTOR: Record<string, number> = {
  NGN: 100,
  USD: 100,
  GHS: 100,
  ZAR: 100,
  KES: 100,
};

const SUPPORTED_CURRENCIES = Object.keys(SUBUNIT_FACTOR);

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}

export function paystackEnvironment(): "test" | "live" | "unconfigured" {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) return "unconfigured";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "test";
}

export function isPaystackCurrencySupported(currency: string): boolean {
  return SUPPORTED_CURRENCIES.includes(currency.toUpperCase());
}

export function toSubunits(currency: string, amount: number): number {
  const factor = SUBUNIT_FACTOR[currency.toUpperCase()];
  if (!factor) {
    throw new Error(`Unsupported Paystack currency: ${currency}`);
  }
  return Math.round(amount * factor);
}

function authHeaders(): Record<string, string> {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not set");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type InitTransactionInput = {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export type InitTransactionResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export async function initTransaction(input: InitTransactionInput): Promise<InitTransactionResult> {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      amount: toSubunits(input.currency, input.amount),
      currency: input.currency.toUpperCase(),
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata ?? {},
    }),
  });

  const json = (await response.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  if (!response.ok || !json.status || !json.data) {
    throw new Error(`Paystack init failed: ${json.message ?? response.statusText}`);
  }

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
  };
}

export type VerifyTransactionResult = {
  status: "success" | "failed" | "abandoned" | "pending";
  amount: number; // in subunits
  currency: string;
  reference: string;
  paidAt: string | null;
  channel: string | null;
  customerEmail: string | null;
  raw: unknown;
};

export async function verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET", headers: authHeaders() },
  );

  const json = (await response.json()) as {
    status: boolean;
    message: string;
    data?: {
      status: VerifyTransactionResult["status"];
      amount: number;
      currency: string;
      reference: string;
      paid_at: string | null;
      channel: string | null;
      customer?: { email: string | null };
    };
  };

  if (!response.ok || !json.status || !json.data) {
    throw new Error(`Paystack verify failed: ${json.message ?? response.statusText}`);
  }

  return {
    status: json.data.status,
    amount: json.data.amount,
    currency: json.data.currency,
    reference: json.data.reference,
    paidAt: json.data.paid_at,
    channel: json.data.channel,
    customerEmail: json.data.customer?.email ?? null,
    raw: json.data,
  };
}

// HMAC-SHA512 of the raw request body using the secret key. Paystack sends
// this in the x-paystack-signature header on every webhook. Constant-time
// compare to avoid timing attacks.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key || !signatureHeader) return false;
  const computed = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(signatureHeader, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type PaystackWebhookEvent = {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    currency: string;
    customer?: { email: string | null };
    [key: string]: unknown;
  };
};
