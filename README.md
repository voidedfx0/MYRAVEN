# MYRAVEN

**Money moves. Intelligence connects.**

MYRAVEN is a global intelligent payments and financial orchestration platform. It is designed to connect people, businesses, payment methods, currencies and supported financial networks through one clear experience.

## Product principles

- MYRAVEN is a payment platform, not primarily a wallet.
- A stored balance is optional; direct-from-source payment should be supported where providers allow it.
- Senders choose how to fund payments; recipients choose verified receiving preferences.
- Fees, exchange rates, expected recipient amounts and transaction status must be transparent.
- AI can explain and prepare actions, but cannot move money without explicit user authorization.
- Global architecture does not mean every country or payment rail is available at launch.

## Current foundation

- Next.js App Router + TypeScript
- React
- Tailwind CSS
- Lucide icons
- Designed for Vercel deployment
- Supabase integration planned, not yet configured

## Getting started

1. Install Node.js (current supported LTS).
2. Install dependencies: `npm install`
3. Start development: `npm run dev`
4. Open `http://localhost:3000`

## Environment

Copy `.env.example` to `.env.local` when configuring Supabase. Do not commit real credentials.

## Important

This repository currently contains the product and UI foundation only. It does not process payments, hold funds, connect to banks, provide custody, or offer live USSD. Those capabilities require provider integrations, security review and country-specific legal/compliance approval.
