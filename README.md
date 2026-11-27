# MYRAVEN

**Money moves. Intelligence connects.**

MYRAVEN is an intelligent payment-orchestration product prototype. Its initial blockchain scope is intentionally limited to **Solana and Stellar**.

## Current demo build

- Next.js App Router, TypeScript, React and Tailwind CSS
- SmartRoute simulation ranking routes by cost, speed, reliability and recipient preference
- Simulated quote API with input validation
- Fictional Solana and Stellar wallet connections
- Sample SOL, XLM and USDC portfolio balances
- Demo payment review and locally recorded demo approvals
- USSD menu and payment-request simulator
- Sample payment activity and transaction statuses
- Responsive dashboard and payment safety messaging

## Demo-only guarantees

**Everything in the current experience is simulated.** No real wallet extension is contacted. Wallet addresses, balances, asset valuations, quotes, fees, route speed, reliability scores, transaction references, payment outcomes and USSD requests are fictional sample data. No external provider, bank, blockchain, telecom operator or payment rail is contacted. No funds move, and no real transaction is signed or submitted.

The demo is designed to exercise product flows and interface behavior. Its sample exchange rates and route scores are not market data, executable offers, availability claims or delivery guarantees.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` only when configuring Supabase for a later stage. Never commit real credentials.

## Initial chain scope

- Solana: SOL and selected SPL assets in future integrations
- Stellar: XLM and selected Stellar assets in future integrations

No other blockchain networks are in the initial scope.
