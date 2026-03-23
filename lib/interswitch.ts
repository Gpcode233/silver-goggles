import crypto from "node:crypto";

export type InterswitchEnvironment = "sandbox" | "live";

export type InterswitchCheckoutFields = {
  merchant_code: string;
  pay_item_id: string;
  site_redirect_url: string;
  txn_ref: string;
  amount: string;
  currency: string;
  cust_email: string;
  cust_name?: string;
  cust_id?: string;
  pay_item_name?: string;
};

export type InterswitchCheckoutSession = {
  actionUrl: string;
  fields: InterswitchCheckoutFields;
  environment: InterswitchEnvironment;
};

export type InterswitchRequeryResponse = {
  Amount?: number;
  MerchantReference?: string;
  PaymentReference?: string;
  RetrievalReferenceNumber?: string;
  TransactionDate?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  AccountNumber?: string;
  CardNumber?: string;
};

const SUCCESS_CODES = new Set(["00", "10", "11"]);
const PENDING_CODES = new Set(["09"]);

function getEnvironment(): InterswitchEnvironment {
  return process.env.INTERSWITCH_ENV?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

export function isInterswitchConfigured(): boolean {
  return Boolean(
    process.env.INTERSWITCH_MERCHANT_CODE?.trim() &&
      process.env.INTERSWITCH_PAY_ITEM_ID?.trim(),
  );
}

export function getInterswitchEnvironment(): InterswitchEnvironment {
  return getEnvironment();
}

function requireConfig() {
  const merchantCode = process.env.INTERSWITCH_MERCHANT_CODE?.trim();
  const payItemId = process.env.INTERSWITCH_PAY_ITEM_ID?.trim();

  if (!merchantCode || !payItemId) {
    throw new Error(
      "Interswitch is not configured. Set INTERSWITCH_MERCHANT_CODE and INTERSWITCH_PAY_ITEM_ID.",
    );
  }

  const environment = getEnvironment();
  return {
    merchantCode,
    payItemId,
    environment,
  };
}

export function getInterswitchCheckoutActionUrl(environment = getEnvironment()): string {
  return environment === "live"
    ? "https://newwebpay.interswitchng.com/collections/w/pay"
    : "https://newwebpay.qa.interswitchng.com/collections/w/pay";
}

export function getInterswitchRequeryBaseUrl(environment = getEnvironment()): string {
  return environment === "live"
    ? "https://webpay.interswitchng.com"
    : "https://qa.interswitchng.com";
}

export function convertMajorToMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function buildInterswitchCheckoutSession(params: {
  txnRef: string;
  amount: number;
  redirectUrl: string;
  customerEmail?: string;
  customerName?: string;
  customerId?: string;
  itemName?: string;
}): InterswitchCheckoutSession {
  const config = requireConfig();
  const customerEmail =
    params.customerEmail?.trim() ||
    process.env.INTERSWITCH_DEFAULT_CUSTOMER_EMAIL?.trim() ||
    "demo@ajently.ai";

  return {
    actionUrl: getInterswitchCheckoutActionUrl(config.environment),
    environment: config.environment,
    fields: {
      merchant_code: config.merchantCode,
      pay_item_id: config.payItemId,
      site_redirect_url: params.redirectUrl,
      txn_ref: params.txnRef,
      amount: String(convertMajorToMinor(params.amount)),
      currency: "566",
      cust_email: customerEmail,
      ...(params.customerName?.trim() ? { cust_name: params.customerName.trim() } : {}),
      ...(params.customerId?.trim() ? { cust_id: params.customerId.trim() } : {}),
      ...(params.itemName?.trim() ? { pay_item_name: params.itemName.trim() } : {}),
    },
  };
}

export async function requeryInterswitchTransaction(params: {
  txnRef: string;
  amount: number;
}): Promise<InterswitchRequeryResponse> {
  const { merchantCode, environment } = requireConfig();
  const baseUrl = getInterswitchRequeryBaseUrl(environment);
  const amountMinor = convertMajorToMinor(params.amount);
  const url = new URL("/collections/api/v1/gettransaction.json", baseUrl);

  url.searchParams.set("merchantcode", merchantCode);
  url.searchParams.set("transactionreference", params.txnRef);
  url.searchParams.set("amount", String(amountMinor));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Interswitch requery failed with status ${response.status}`);
  }

  return (await response.json()) as InterswitchRequeryResponse;
}

export function isInterswitchSuccessCode(code?: string | null): boolean {
  return Boolean(code && SUCCESS_CODES.has(code));
}

export function isInterswitchPendingCode(code?: string | null): boolean {
  return Boolean(code && PENDING_CODES.has(code));
}

export function verifyInterswitchWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.INTERSWITCH_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const computed = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const computedBuffer = Buffer.from(computed);
  const receivedBuffer = Buffer.from(signature.trim().toLowerCase());
  if (computedBuffer.length !== receivedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(computedBuffer, receivedBuffer);
}
