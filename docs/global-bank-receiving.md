# Global bank receiving: country and rail catalogue

This is a product/reference catalogue, not a claim that MYRAVEN can currently issue accounts in every listed market. Real account issuance must be confirmed at runtime against an approved provider, MYRAVEN's onboarding entity, user eligibility, KYC/KYB status, and provider corridor configuration.

## Product rules

1. A recipient selects the country where they want to receive a domestic bank transfer.
2. MYRAVEN resolves the country's default currency from the country metadata. Where multiple currencies are valid, the recipient may choose an eligible currency.
3. MYRAVEN requests current receiving-account capabilities from configured providers. Never infer account-issuance support from payout coverage.
4. Show only banks/institutions returned by the selected provider or its bank-directory API. Some providers issue a virtual account with a sponsoring bank automatically; in that case do not offer a fictitious bank picker.
5. Create a receiving account only through the provider's authenticated server API. Store the provider account ID, beneficiary name, bank name, account/routing identifiers, currency, country, supported rails, status, and expiry/refresh metadata.
6. Mark an account usable only after provider status is ACTIVE. PROCESSING/PENDING must not be displayed as ready-to-receive.
7. Confirm incoming transfers from signed provider webhooks/reconciliation, then post to the double-entry ledger idempotently. Never credit from a client redirect or a user-submitted screenshot.
8. If no local account can be issued, show the real available alternatives (for example, supported local payment method, international SWIFT details, or unavailable/waitlist) without inventing account numbers.
9. Country and currency metadata is not a substitute for licensing, safeguarding, KYC/KYB, sanctions screening, or provider approval.

## Country and local-rail reference

| Country/market | ISO | Default currency | Local bank/payment rail reference |
|---|---|---|---|
| Australia | AU | AUD | BECS, NPP/Osko |
| Austria | AT | EUR | SEPA / SEPA Instant |
| Bahrain | BH | BHD | Fawri+ |
| Bangladesh | BD | BDT | NPSB |
| Belgium | BE | EUR | SEPA / SEPA Instant |
| Brazil | BR | BRL | Pix |
| Canada | CA | CAD | EFT, Interac |
| China | CN | CNY | UnionPay / local clearing |
| Czech Republic | CZ | CZK | CERTIS; SEPA for EUR |
| Denmark | DK | DKK | Intradagclearing; SEPA for EUR |
| Estonia | EE | EUR | SEPA / SEPA Instant |
| Finland | FI | EUR | SEPA / SEPA Instant |
| France | FR | EUR | SEPA / SEPA Instant |
| Germany | DE | EUR | SEPA / SEPA Instant |
| Ghana | GH | GHS | Ghana Mobile Money / bank transfer |
| Greece | GR | EUR | SEPA / SEPA Instant |
| Hong Kong | HK | HKD | FPS / CHATS |
| Hungary | HU | HUF | GIRO; SEPA for EUR |
| India | IN | INR | UPI, IMPS, NEFT, RTGS |
| Indonesia | ID | IDR | BI-FAST, SKN, RTGS |
| Ireland | IE | EUR | SEPA / SEPA Instant |
| Israel | IL | ILS | MASAV / ZAHAV |
| Italy | IT | EUR | SEPA / SEPA Instant |
| Japan | JP | JPY | Zengin |
| Kenya | KE | KES | M-Pesa / local bank transfer |
| Malaysia | MY | MYR | DuitNow, RENTAS, GIRO |
| Mexico | MX | MXN | SPEI |
| Netherlands | NL | EUR | SEPA / SEPA Instant |
| New Zealand | NZ | NZD | Direct Credit / NPP |
| Nigeria | NG | NGN | NIP / local bank transfer |
| Norway | NO | NOK | Local bank transfer; SEPA for EUR |
| Pakistan | PK | PKR | IBFT / RTGS |
| Philippines | PH | PHP | InstaPay / PESONet |
| Poland | PL | PLN | Elixir / Express Elixir |
| Portugal | PT | EUR | SEPA / SEPA Instant |
| Rwanda | RW | RWF | Mobile Money / local bank transfer |
| Saudi Arabia | SA | SAR | SARIE |
| Singapore | SG | SGD | FAST / GIRO |
| South Africa | ZA | ZAR | EFT / PayShap |
| South Korea | KR | KRW | Local bank transfer |
| Spain | ES | EUR | SEPA / SEPA Instant |
| Sri Lanka | LK | LKR | SLIPS |
| Sweden | SE | SEK | Bankgirot / local clearing; SEPA for EUR |
| Switzerland | CH | CHF | SIC; SEPA for EUR |
| Tanzania | TZ | TZS | Mobile Money / local bank transfer |
| Thailand | TH | THB | PromptPay |
| Turkey | TR | TRY | FAST / EFT |
| Uganda | UG | UGX | Mobile Money / local bank transfer |
| United Arab Emirates | AE | AED | IPI / UAEFTS |
| United Kingdom | GB | GBP | Faster Payments, BACS, CHAPS |
| United States | US | USD | ACH, Fedwire, FedNow/RTP where eligible |
| Vietnam | VN | VND | NAPAS |

The table is a discovery/UX reference. Before launch, validate every country, currency, rail, and account-issuance capability against live provider APIs and the applicable provider contract. The supported local rails above are not all offered by one provider.

## Provider research and integration candidates

- Airwallex Global Accounts: local receiving details documented for Australia, Canada, Denmark, Estonia, Germany, Hong Kong, Indonesia, Israel, Malaysia, Mexico, Netherlands, New Zealand, Poland, Singapore, UAE, UK, and US, subject to onboarding-entity and account eligibility restrictions. Its payout network is broader than its receiving-account coverage.
- Payoneer Receiving Accounts: local transfer details documented for US/USD, Eurozone/EUR, UK/GBP, Japan/JPY, Australia/AUD, Canada/CAD, Hong Kong/HKD, Singapore/SGD, UAE/AED, and Mexico/MXN, subject to eligibility and terms.
- Flutterwave: regional collection methods include bank transfer, USSD, cards and mobile money; virtual-account capabilities and currencies depend on merchant approval and market.
- Other regional providers should be evaluated for markets not covered by the selected primary provider. Do not route or issue accounts until the provider is contracted and approved.

## MYRAVEN implementation contract

Suggested server-side API shape:
- GET /api/receiving/countries — return configured countries, default currencies, and current provider-backed receiving capabilities.
- GET /api/receiving/countries/{countryCode}/options — return only eligible currencies, providers, transfer rails, and provider-sourced institution options.
- POST /api/receiving/accounts — authenticated request to create a receiving account; enforce user/business eligibility and idempotency.
- GET /api/receiving/accounts — list the signed-in user's receiving accounts.
- Provider webhook endpoint — verify signature, deduplicate event, reconcile incoming payment, and post balanced ledger entries.

Do not expose provider secrets, service-role keys, or raw provider credentials to the browser. MYRAVEN is currently a preview and has no live bank-account issuance provider configured; the UI must clearly label this capability as unavailable until a provider is approved and connected.
