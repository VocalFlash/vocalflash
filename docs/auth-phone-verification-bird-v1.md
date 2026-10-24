# VocalFlash — Supabase Auth phone verification via Bird

## Current status (2026-10-24)

- **Implemented on an isolated branch only:** `supabase/functions/send-sms/index.ts`.
- **Not deployed:** no Edge Function is present in the Supabase project yet.
- **Not configured:** no Bird credentials/sender and no Supabase Auth Send SMS Hook configured by this change.
- **Automated tests added on the isolated branch:** `supabase/functions/send-sms/index_test.ts`, covering fail-closed configuration, valid/missing/tampered signatures, malformed event, provider rejection, timeout/no-blind-retry, provider acceptance, and stable Bird idempotency key. The dedicated workflow is `.github/workflows/bird-sms-hook-tests.yml`; its current-head result still needs authoritative confirmation.
- **Not tested end to end:** no SMS has been sent; no user or business member has been created.
- **No production data/schema was changed.**

## Intended flow

Supabase Auth generates and validates the OTP. Its signed Send SMS Hook calls the Edge Function. The function verifies the Standard Webhooks signature and forwards the OTP to Bird's EU API as an authentication SMS. The client verifies the OTP with Supabase Auth; the app must never validate the OTP itself or treat an unverified phone number as an owner.

## Required configuration — do not put values in GitHub issues or chat

Before any real SMS test, verify that the new automated test workflow passes, review the function, then configure secrets through the Supabase project dashboard:

- `SEND_SMS_HOOK_SECRETS`: the signing secret shown when configuring the Supabase Auth Send SMS Hook. Store the full `v1,whsec_...` value. Rotation values may be separated with `|`.
- `BIRD_API_KEY`: a Bird API key for the EU region, only after the implementation has been reviewed and the account's billing/charges understood.
- `BIRD_SMS_SENDER`: a sender that Bird confirms is available for the account and permitted for authentication traffic to Italy.

The function deliberately fails closed if any secret or sender is missing. It does not log the OTP, phone number, authorization header, webhook body, or Bird response body.

## Controlled activation checklist

1. **Review and test before deployment.** Confirm the isolated Deno tests pass for signature failure, malformed event, missing configuration, provider rejection, timeout and idempotency key propagation. Confirm the hook's maximum execution time remains within Supabase's HTTP-hook timeout.
2. Confirm Bird account status, Italy destination allowlist, permitted sender, message category and current per-segment/registration/carrier charges. Do not buy credits or send messages until the owner has explicitly approved the cost.
3. Deploy this Edge Function to the intended **non-production** Supabase project only after review. Because the function authenticates requests with the Supabase Auth Standard Webhooks signature rather than a user JWT, deploy with Supabase CLI's `--no-verify-jwt` option (or the equivalent reviewed function setting). Do not expose this endpoint as a general public SMS API; reject every request that fails signature verification.
4. Add the function secrets in the Supabase dashboard; never commit them.
5. In Supabase Authentication settings, enable phone authentication and ensure automatic phone confirmation is disabled. Configure the Send SMS Hook to call this function and use the same signing secret. The secret configured in Auth and the function must match.
6. Verify that OTP rate limits, expiry, abuse protection, and redirect/site settings are suitable. A valid provider response is only acceptance by Bird, not proof of handset delivery.
7. With explicit owner approval for a real billable SMS, request an OTP for the owner's intended phone, receive it on the device, and enter it directly into the trusted VocalFlash onboarding UI. Never send the OTP to an assistant, issue, log, or support message.
8. Confirm Supabase Auth reports the phone as verified. Only then, through the application's guarded onboarding path, associate the authenticated user ID with the intended business. Do not manually insert a made-up UUID or mark the phone verified in SQL.
9. Re-query read-only counts and the exact membership row; confirm the user is linked to the correct business and role. Do not create a business member until verification and authorization checks succeed.

## Failure semantics and limitations

- A bad/missing signature is rejected.
- Bird's HTTP acceptance is not delivery confirmation.
- The function passes the signed Standard Webhooks `webhook-id` as Bird's `Idempotency-Key`. This lets repeated deliveries of the same hook resolve to the same provider acceptance while Bird retains the key (documented retention: 3 hours). It does not make delivery exactly-once, prove handset delivery, or replace the durable application outbox.
- Timeout/provider errors fail the hook; there is no blind retry inside this function because an uncertain provider outcome must not be mistaken for a confirmed send. If an external retry occurs, the stable idempotency key reduces duplicate provider acceptance within the retention window.
- The current implementation has not yet been deployed or exercised against Bird. Unit tests have been added, but their latest CI result must be checked before treating them as passed.
- The Supabase project currently has zero Auth users and zero business members. This is an observed baseline, not a reason to bypass verification.
- This function sends an OTP only; it does not create an account, establish an owner role, or write a business membership.
