# MYRAVEN

**Money moves. Intelligence connects.**

MYRAVEN is an intelligent global payment-orchestration platform built around **Solana as its only blockchain network**.

## Product architecture

- **Global funding:** compatible bank transfers, cards, local payment methods and supported crypto assets.
- **Funding conversion:** fiat deposits are converted by an approved on-ramp into a supported Solana asset selected by the user.
- **Solana deposit engine:** verifies supported on-chain deposits and confirmation status before crediting an account.
- **Unified ledger:** records deposits, conversions, transfers, fees, holds and payout states with idempotency and audit events.
- **Global currency engine:** produces timestamped, expiring executable quotes when connected to liquidity providers.
- **SmartRoute:** ranks eligible payout routes by cost, speed, reliability and recipient preference.
- **Global receiving:** supported bank accounts, mobile-money methods, MYRAVEN IDs and Solana addresses.
- **Payment safety:** explicit user authorization, quote expiry, stage-aware recovery and duplicate-execution protection.

## Current repository state

The current dashboard is a product preview. Phantom connection, when available, verifies a public Solana address only. The quote engine still produces illustrative simulation data. No live card processor, bank, fiat on-ramp, crypto exchange, payout provider, custody service, or Solana transaction execution is configured by this repository.

**No real funds move in the current build.** Do not interpret demo balances, sample fees, estimated timings, route scores or example activity as live financial data.

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
- No Stellar or other blockchain networks are in scope.
