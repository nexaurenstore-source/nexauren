# Nexauren Marketplace Worker

Dedicated Cloudflare Worker for the Nexauren Store/Marketplace.

## Responsibilities

- Marketplace catalog and categories
- Product detail API
- Persistent cart and wishlist
- One-time PayPal checkout
- Payment verification and order fulfillment
- Entitlements and protected digital downloads
- Reviews and product questions
- Marketplace admin product API
- Store static assets under `/nexauren-store/*`

## Data boundaries

`MARKETPLACE_DB` owns Marketplace tables and commerce state.

`DB` remains the source of truth for Nexauren users, sessions and the shared payment ledger.

The Worker reads the existing `nexauren_session` cookie and validates it against `DB`; it does not create a second user system.

## Required runtime secrets/variables

Set these on the `nexauren-marketplace` Worker before production deployment:

- `ADMIN_EMAIL`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_ENVIRONMENT` (`sandbox` or `live`)
- `PAYMENT_PROVIDER` (`paypal`)
- `PAYMENT_BRAND_NAME` (`Nexauren`)
- Optional: `PAYMENT_RETURN_URL`
- Optional: `PAYMENT_CANCEL_URL`

PayPal credentials must be Worker secrets and must never be committed to Git.

## Deployment

From the repository root:

```bash
npm run check:marketplace-worker
npm run db:marketplace:migrations:apply
npx wrangler deploy --config marketplace-worker/wrangler.json
```

Or:

```bash
npm run deploy:marketplace
```

The production routes are:

- `nexaurenstory.com/nexauren-store/*`
- `nexaurenstory.com/api/store/*`

The main Nexauren Worker no longer needs the Marketplace D1 binding or Marketplace runtime patches.

## Production API routing note

The `/api/store/*` route must be served by the dedicated `nexauren-marketplace` Worker. If a product page reports `Unexpected token '<'` while parsing JSON, the request is receiving an HTML response instead of the Marketplace API JSON. Redeploy this Worker with `marketplace-worker/wrangler.json` so the `/api/store/*` route is active before troubleshooting product data in D1.
