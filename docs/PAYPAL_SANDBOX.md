# Nexauren PayPal Sandbox

The Nexauren billing integration is provider-independent and currently prepared for PayPal Sandbox. No PayPal production credential belongs in this repository.

## Runtime configuration

Configure these values as Cloudflare Worker environment variables/secrets, never in frontend code or Git:

- `PAYMENT_PROVIDER=paypal`
- `PAYPAL_ENV=sandbox`
- `PAYPAL_CLIENT_ID` — secret/runtime configuration value from the PayPal Sandbox REST app
- `PAYPAL_CLIENT_SECRET` — secret/runtime configuration value from the PayPal Sandbox REST app
- `PAYPAL_WEBHOOK_ID` — ID of the webhook registered for the same PayPal REST app
- `PAYMENT_RETURN_URL` — `https://YOUR-DOMAIN/billing/success/`
- `PAYMENT_CANCEL_URL` — `https://YOUR-DOMAIN/billing/failed/`
- `PAYMENT_BRAND_NAME=Nexauren`
- `PAYPAL_PLAN_<PLAN_ID>` — PayPal Sandbox billing-plan ID for each enabled Nexauren subscription plan

Optional:

- `PAYPAL_CANCEL_OPTION=END_OF_PERIOD` when the PayPal account/API capability supports that cancellation mode. The integration keeps the local `cancel_at_period_end` state until the provider confirms the lifecycle event.

## Webhook URL

Register exactly:

`https://YOUR-DOMAIN/api/webhooks/paypal`

The webhook must belong to the same PayPal REST app whose credentials are configured above.

Recommended subscription/payment events:

- `CHECKOUT.ORDER.APPROVED`
- `CHECKOUT.PAYMENT-APPROVAL.REVERSED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`
- `PAYMENT.SALE.REVERSED`
- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`

## Security rules

- Never commit `PAYPAL_CLIENT_SECRET`.
- Never expose PayPal access tokens to the browser.
- Never trust price or credit quantities from the browser.
- Credits are granted only after backend verification.
- The success page never grants credits.
- PayPal webhook signatures are verified against `PAYPAL_WEBHOOK_ID`.
- Webhook processing uses PayPal `event.id` as the stable event identity.
- Failed webhook records remain retryable.
- Payment, cycle, credit-ledger and webhook records have database idempotency protections.

## Sandbox test order

1. Configure Sandbox credentials only.
2. Configure the Sandbox webhook and copy its ID to `PAYPAL_WEBHOOK_ID`.
3. Configure a Sandbox subscription product/plan and map its PayPal plan ID.
4. Run the existing architecture/billing checks.
5. Test a credit purchase.
6. Test a duplicate webhook.
7. Test a subscription approval and activation.
8. Test a subscription payment cycle.
9. Test cancellation, failure and refund events.
10. Test two simultaneous credit-usage requests.
11. Only after all Sandbox cases pass, prepare production configuration.
