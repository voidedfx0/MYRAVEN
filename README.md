# MYRAVEN

**Money moves. Intelligence connects.**

MYRAVEN is an intelligent payment-orchestration product prototype. Its initial blockchain scope is intentionally limited to **Solana and Stellar**.

## Current build

- Next.js App Router, TypeScript, React and Tailwind CSS
- SmartRoute simulation that ranks route options using cost, speed, reliability and destination preference
- Quote API with input validation
- Solana browser-wallet address connection (injected provider)
- Stellar Freighter / Varial address connection (injected provider)
- Wallet addresses remain in browser memory only; this prototype does not persist wallet connections
- Payment review UI with explicit demo approval
- Responsive dashboard and payment safety messaging

## Important limitations

This is a **non-production simulation**. Quotes use illustrative fixed assumptions, not live exchange rates or provider quotes. The route ranking does not establish real availability, executable prices, delivery guarantees or provider reliability. Wallet connections are read-only address discovery; no transaction signing, token transfers, custody, deposits, withdrawals or live payment execution is implemented.

Before real payment functionality, MYRAVEN needs audited provider integrations, server-side quote verification, idempotent payment orchestration, transaction monitoring, key/secret management, wallet signing UX, security testing, and country-specific legal/compliance review. Do not store seed phrases or private keys. A quote or countdown must never authorize a payment.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when configuring Supabase. Never commit real credentials.

## Supported chain scope

- Solana: SOL and supported SPL assets, subject to future asset/provider validation
- Stellar: XLM and supported Stellar assets, subject to future asset/provider validation

No other blockchain networks are in the initial scope.
