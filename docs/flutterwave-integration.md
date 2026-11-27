# Flutterwave funding integration

MYRAVEN uses Flutterwave hosted checkout for the first fiat collection adapter.

## Server environment variables

Set these in Vercel for Preview first:

- `FLW_SECRET_KEY`: Flutterwave **test** secret key.
- `FLW_SECRET_HASH`: webhook secret hash configured in Flutterwave.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key. Server-only; never prefix with `NEXT_PUBLIC_`.

Never commit these values or paste them into chat.

## Routes

- `POST /api/funding/checkout`: authenticated users create a fiat funding request and receive a Flutterwave hosted checkout URL.
- `POST /api/webhooks/flutterwave`: validates the `verif-hash` header, verifies the transaction against Flutterwave, and checks reference, currency and amount.

Configure the webhook URL as `https://YOUR_DOMAIN/api/webhooks/flutterwave`.

## Important settlement boundary

A successful Flutterwave collection is recorded as `converting`. It is **not** credited as SOL or USDC. MYRAVEN's funding schema requires a SOLANA asset credit, so a licensed/approved fiat-to-crypto conversion and custody/on-chain settlement provider must be connected before a verified collection can become a wallet balance. Never change this state to `credited` from the browser or from a redirect callback.

Flutterwave checkout methods are selected/filtered by Flutterwave according to the merchant account and currency. Do not infer a live eligible method from the country list alone. Test mode simulates payments; live mode requires Flutterwave business approval.
