# MYRAVEN Funding — single-page product specification

All fiat and crypto wallet funding belongs on one Funding page. Do not create a separate Receiving page or describe the user flow as receiving money. The purpose is to let a user add funds to their MYRAVEN wallet.

## Country catalogue

`src/data/funding-countries.json` contains all 249 ISO 3166-1 country/territory entries from the referenced country-code dataset, with ISO alpha-2 code, display name, region, and available ISO 4217 currency code/name metadata. It is a country/currency reference catalogue, not a live availability list. Some territories may have multiple currencies; some have no ordinary currency mapping. If more than one currency is listed, show the eligible choices rather than silently assuming one.

## Funding page journey

1. User opens **Funding** and chooses **Bank transfer**, **Local payment method**, **Mobile money**, **Card**, or **Crypto**.
2. For country-based fiat methods, country selector searches the full catalogue. Use the selected country's currency mapping as the initial currency choice, and show a currency selector when multiple currencies are mapped or the provider supports additional settlement currencies.
3. Fetch provider-backed funding options from the server for the selected country, currency, account type (personal/business), amount, and user's eligibility.
4. Display only methods and banks/institutions actually returned as eligible by the configured provider. Never populate a fake bank list from generic country data. Some providers return a dedicated virtual account automatically; if so, show those bank details as the payment instructions instead of presenting an unsupported bank picker.
5. If the provider supports a named bank selection, let the user select from its live bank-directory response.
6. Create a funding intent and obtain provider-issued payment instructions, checkout session, virtual account reference, or other supported local funding instruction. Do not invent account numbers or imply a bank account has been issued if the provider only returns a payment reference.
7. Show amount, currency, fees, expiry, estimated processing time, and exact payment instructions returned by the provider. Require explicit user confirmation before starting a charge or redirecting to checkout.
8. Credit the MYRAVEN wallet only after a verified provider webhook or confirmed on-chain deposit. Reconcile and post ledger entries idempotently. A client redirect, uploaded receipt, or user claim is not proof of payment.

## Unified funding methods

- Bank transfer: domestic bank transfer and international/SWIFT where a provider supports it.
- Local payment methods: country-specific bank rails, instant-payment schemes, QR payment, USSD, and supported cash/voucher rails.
- Mobile money: for example M-Pesa, MTN MoMo, Airtel Money and other provider-backed networks where available.
- Cards: debit/credit card funding through an approved processor; use tokenized payment-method references, never store raw PAN/CVV.
- Crypto: Solana wallet funding for supported SOL and SPL assets. This remains part of Funding, not a separate product.

## Provider and availability model

No country should be marked live just because its currency or a local rail is known. The current repository README states that no live fiat on-ramp, card processor, bank funding provider, or payout provider is configured. Until one is connected and approved, the page must clearly show that live fiat funding is not yet available.

Build provider adapters so the UI is not hard-coded to one provider. Candidate providers to assess include Airwallex, Flutterwave, Paystack, and other licensed regional providers. Provider capabilities differ: payout coverage does not prove inbound wallet-funding or virtual-account issuance coverage. Provider contracts, entity onboarding, KYC/KYB, licensing, corridor eligibility, and method-level enablement must be checked independently.

Suggested endpoints:
- `GET /api/funding/countries` — return the full country catalogue and current configured funding availability.
- `GET /api/funding/options?country=NG&currency=NGN` — return only current eligible methods, banks, providers, fees, and limits.
- `POST /api/funding/intents` — authenticated, idempotent funding-intent creation.
- `GET /api/funding/intents/{id}` — retrieve current funding status and instructions.
- Provider-specific signed webhook endpoints — verify signatures, deduplicate events, reconcile payments, and post ledger entries.

## Safety and correctness

- Country/currency defaults are metadata; provider support is a separate live decision.
- Detect currency from selected country and allow explicit user override only when the provider supports that currency.
- Never show a bank or method as selectable unless it is returned by the active provider configuration.
- Never create account numbers locally. Any local account details must be issued by the regulated provider/bank and linked to the funding intent.
- Apply personal/business account eligibility and verification rules before starting regulated payment flows.
- Keep provider secrets, Supabase service-role keys, and signing credentials server-side.
- Maintain idempotency, webhook signature verification, reconciliation, fraud controls, transaction limits, and a double-entry ledger.
- Clearly distinguish unavailable, simulated, pending, expired, failed, and completed states.
