# MYRAVEN

**Money moves. Intelligence connects.**

MYRAVEN is an intelligent global payment-orchestration platform built around **Solana as its only blockchain network**.

## Product architecture

- **Global funding:** compatible bank transfers, cards, local payment methods and supported crypto assets.
- **Funding conversion:** fiat and supported crypto deposits are intended to convert through an approved on-ramp into a supported Solana asset selected by the user.
- **Provider abstraction:** typed on-ramp contracts keep provider quotes, checkout sessions and signed webhook verification behind a provider adapter; no provider is registered yet.
- **Funding readiness API:** `GET /api/funding/readiness` reports Solana assets and funding methods while keeping deposits disabled until a provider adapter is approved and configured.
- **Solana deposit engine:** verifies supported on-chain deposits and confirmation status before crediting an account.
- **Unified ledger:** records deposits, conversions, transfers, fees, holds and payout states with idempotency and audit events.
- **Global currency engine:** produces timestamped, expiring executable quotes when connected to liquidity providers.
- **SmartRoute:** ranks eligible payout routes by cost, speed, reliability and recipient preference.
- **Global receiving:** supported bank accounts, mobile-money methods, MYRAVEN IDs and Solana addresses.
- **Payment safety:** explicit user authorization, quote expiry, stage-aware recovery and duplicate-execution protection.

## Current repository state

The current dashboard is a product preview. Phantom connection, when available, verifies a public Solana address only. The Add Money panel captures a funding-method and settlement-asset selection but does not start a payment. The quote engine still produces illustrative simulation data. No live card processor, bank, fiat on-ramp, crypto exchange, payout provider, custody service, or Solana transaction execution is configured by this repository.

**No real funds move in the current build.** Do not interpret demo balances, sample fees, estimated timings, route scores or example activity as live financial data.

## Supabase foundation

The connected Supabase project contains user profiles, business memberships, receiving preferences, tokenized payment-method references, payment intents and attempts, notifications, plus the Solana funding and ledger foundation:

- `funding_deposits` tracks fiat/crypto source, selected Solana asset, provider references, on-chain signature, idempotency key and lifecycle status.
- `payment_corridors` stores provider-, country-, currency-, method- and asset-specific funding/payout availability with expiry timestamps; the platform must check current corridor eligibility before offering a route.
- `ledger_accounts`, `ledger_transactions` and `ledger_entries` provide a double-entry ledger data model.
- Row-level security is enabled. Users can read only their own funding and ledger records; clients cannot write to these tables.
- `post_ledger_transaction` is an invoker-rights database function granted only to `service_role`. It validates balanced entries per asset and uses idempotency to prevent duplicate postings.

## Live integration requirements

Real-money functionality requires selected providers, approved accounts and credentials, supported country corridors, applicable licensing/compliance arrangements, security review, reconciliation and operational monitoring. Provider secrets must remain server-side. Client code must never receive custody keys, service-role keys or signing secrets.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Blockchain scope

- Solana mainnet / devnet as configured per environment
- SOL and supported SPL assets, subject to token and provider allowlists
- Solana is the only supported blockchain network in scope.
