export type FundingMethod = "card" | "bank_transfer" | "local_payment" | "crypto_wallet";
export type SolanaAsset = "SOL" | "USDC";

export type FundingRequest = {
  userId: string;
  method: FundingMethod;
  inputKind: "fiat" | "crypto";
  inputCurrency: string;
  inputAmount: string;
  targetAsset: SolanaAsset;
  solanaAddress: string;
  countryCode: string;
  idempotencyKey: string;
};

export type FundingQuote = {
  providerCode: string;
  inputCurrency: string;
  inputAmount: string;
  outputAsset: SolanaAsset;
  outputAmount: string;
  feeAmount: string;
  feeCurrency: string;
  expiresAt: string;
  countryCode: string;
  paymentMethod: FundingMethod;
};

export type FundingSession = {
  providerCode: string;
  providerReference: string;
  checkoutUrl?: string;
  depositInstructions?: Record<string, string>;
  expiresAt?: string;
};

export interface SolanaOnRampProvider {
  readonly code: string;
  getQuote(request: FundingRequest): Promise<FundingQuote>;
  createSession(request: FundingRequest, quote: FundingQuote): Promise<FundingSession>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<{
    providerReference: string;
    status: "processing" | "settled" | "failed";
    transactionSignature?: string;
  }>;
}
