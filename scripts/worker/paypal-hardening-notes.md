# PayPal integration hardening

This file documents the required Sandbox hardening sequence before production.

- Use PAYPAL_ENV=sandbox until end-to-end Sandbox tests pass.
- Keep PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID server-side only.
- Verify webhook signatures using PayPal's official verification API and the configured webhook ID.
- Treat webhook delivery as at-least-once; use provider + event_id and payment/reference uniqueness for idempotency.
- For one-time checkout, capture only after CHECKOUT.ORDER.APPROVED and fulfill only after a confirmed completed capture.
- For subscriptions, process PAYMENT.SALE.COMPLETED for billing cycles and synchronize BILLING.SUBSCRIPTION.ACTIVATED/UPDATED/EXPIRED/CANCELLED/SUSPENDED/PAYMENT.FAILED.
- Never grant credits from a success/return URL alone.
- Validate amount, currency, product/plan mapping, and the Nexauren reference before crediting.
- Validate concurrency of credit consumption before production.
