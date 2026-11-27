import type { SolanaOnRampProvider } from "./types";

/**
 * Provider adapters are registered here after partner approval, credentials,
 * webhook verification and country/currency capability checks are complete.
 * Never infer provider availability from a client-supplied country or currency.
 */
const providers: SolanaOnRampProvider[] = [];

export function getSolanaOnRampProviders(): readonly SolanaOnRampProvider[] {
  return providers;
}

export function getFundingIntegrationStatus() {
  return {
    configured: providers.length > 0,
    chain: "SOLANA" as const,
    supportedAssets: ["SOL", "USDC"] as const,
    methods: ["card", "bank_transfer", "local_payment", "crypto_wallet"] as const,
    message: providers.length
      ? "Provider adapters are registered. Country and transaction eligibility must still be checked per request."
      : "No approved funding provider is connected. Deposit requests must remain disabled.",
  };
}
