# Activity notifications and Resend

Activity emails are separate from Supabase Auth's SMTP configuration. Signing up/resetting a password still uses Auth. The app uses Resend's HTTPS API for activity notifications.

## Production setup (Vercel Hobby)

1. Apply the new migration before deploying the application:
   ```sh
   npx supabase db push
   ```
   The migration is `202609230001_notification_channels.sql`. Existing in-app choices are preserved; all email switches and new activity rules start off. The migration does not send any emails or backfill old activities.
2. Set these **server-only** Vercel Production environment variables, then redeploy:
   - `NOTIFICATION_EMAIL_MODE=resend`
   - `RESEND_API_KEY`: a Resend key permitted to send from your verified domain.
   - `RESEND_FROM_EMAIL`: e.g. `NTNUI D2A <varsler@your-verified-domain.no>`.
   - `SUPABASE_SECRET_KEY`: the existing Supabase secret/service-role key used for match sync.
   - `CRON_SECRET`: a long random value (reuse the existing match-sync cron secret).
   - `NEXT_PUBLIC_SITE_URL`: the public HTTPS origin of your deployed app. Email links use this origin, never request headers.
3. Configure automatic retries with Supabase Cron. Enable Cron (`pg_cron`) and `pg_net` in the Supabase dashboard. Add two secrets in Supabase Vault:
   - `notification_email_url`: `https://YOUR-DOMAIN/api/cron/notifications`
   - `notification_email_cron_secret`: the same `CRON_SECRET` as Vercel.
     Run [`supabase/setup-notification-email-cron.sql`](../supabase/setup-notification-email-cron.sql) in the hosted SQL editor. It invokes the protected delivery route every five minutes without storing the secret in the job text. Re-running replaces the same named job. This script is separate from migrations because it depends on the deployed domain and Vault configuration.
4. Open **Administrasjon → Varselinnstillinger**. Check delivery configuration, enable **I appen** and/or **E-post** for the desired rules, and save each row. Configuration readiness confirms environment variables, not sender verification or actual delivery. Check recent email status and Resend logs after the next intended activity.

New posts/events, comments, reactions, fines and point changes trigger background delivery immediately after the successful server action. Supabase Cron retries pending jobs independently of traffic. `vercel.json` also includes a daily 05:30 UTC fallback, compatible with Hobby; that daily fallback alone does not provide prompt retries. No paid Vercel plan is required.

Reference: [Resend sending API](https://resend.com/docs/api-reference/emails/send-email), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Vault with scheduled HTTP requests](https://supabase.com/docs/guides/functions/schedule-functions).

## Rules and recipients

- Normal posts: approved members except the author. Coach posts have a separate rule. Posts published with a selected responsibility use that role's rule or the all-responsibilities rule. Coach lineup publications can match either the coach-post or lineup rule.
- New events: approved members except the creator. Role rules follow the existing event responsibility mapping (e.g. social → Sosialansvarlig, logistics → Oppmann), with a separate coach rule. Event-type rules can also enable delivery.
- Comments on a post/event: its author/creator only. Replies: the immediate parent comment's author only. Reactions: the post/event author only. Self-comments/reactions do not notify the actor; edits and removal do not create new activity notifications.
- Fines and volunteer point changes: only the affected member. Same-value point saves and retries of a fine submission do not emit another notification. Fine emails include the type and amount, but not the optional note.
- Volunteer assignments: only the assigned player.
- Multiple matching rules produce at most one message per recipient/channel. Each channel is enabled if **any** matching rule enables it; to stop a category, turn off all matching broader and specific rules.
- Only approved accounts receive activity notifications. Email recipients must additionally have a confirmed email. The actor can receive a personal assignment/fine/points notification concerning themselves.

The in-app and email switches are independent. Disabling one does not disable the other or remove past notifications. Turning off an email rule cancels its pending jobs and stops claimed jobs that have not yet begun sending; an email already accepted by Resend cannot be recalled.

## Delivery and privacy

The transactional email queue is protected by RLS and inaccessible to browser roles. Service-role-only RPCs lease jobs, freeze payloads, and record outcomes; ordinary users cannot fabricate notifications or choose recipients. Each request contains one recipient, never a group CC list. User text is HTML-escaped and links point to authenticated app pages.

Concurrent workers use row locks and expiring leases. Retries reuse the same payload and Resend idempotency key. Transient failures use exponential backoff (up to eight attempts). Because [Resend idempotency keys last 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys), uncertain jobs stop retrying after 23 hours from their first attempt rather than risk duplicate email. Unattempted pending jobs can be processed later. Permanent rejections and exhausted retries appear as failed in the admin page; they are not automatically resent after a configuration fix.

The admin page shows queue counts and recent messages. “Sendt til Resend” means accepted by the provider, not confirmed inbox delivery; bounce/delivery information remains in Resend. Logs contain generic errors/status codes, not recipient addresses, message bodies or credentials. Disabled accounts, changed/unconfirmed email addresses, deleted posts/events and cancelled fines are checked again before sending.

## Local demo

`npm run dev` forces `NOTIFICATION_EMAIL_MODE=preview`, clears the external API key and connects only to the temporary local database. Enable an email rule and create the corresponding activity: the admin delivery panel shows the preview and recipient name. No email is sent. Preview mode is rejected on Vercel and in production. The integration tests also use mocked Resend responses, never real deliveries.
