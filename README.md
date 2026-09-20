# NTNUI Volleyball D2A

A private, single-team web app built from `ntnuivolleyballd2a-codex-instructions.md`. Norwegian Bokmål UI, dark mode, Next.js App Router, TypeScript, Supabase Auth/Postgres/Storage, and Zod.

## What is implemented

- Email/password registration, email confirmation callback, password recovery, and pending/approved/rejected/disabled accounts.
- Admin approval, rejection, deactivation/reactivation, player/coach roles, jersey numbers, secondary roles, and player positions. Admin promotion is **only** a direct database operation.
- Paginated posts, historical author/role snapshots, own-post editing, admin moderation, and optional private images with descriptions.
- Upcoming and archived events, category permissions, match opponents/home-away/results, and structured volunteer assignments. No local attendance/RSVP system.
- A roster without email addresses or admin accounts; coach/admin position editing.
- Incomplete lineup drafts, a responsive court and separate libero, immutable versioned snapshots, accessible player lists, publication to the match and feed, and revision history.
- In-app notifications, per-user read state, and 13 admin-controlled triggers, all disabled initially.
- Database-enforced authorization, stale-edit checks, private image delivery, automated PostgreSQL/RLS tests, browser tests, and CI.

Without Supabase configuration the application displays the sign-in/setup state. It does not expose a demo session or bypass private routes.

### Post and lineup fixes

The feed crash was caused by treating `post_media` as an array. Its unique `post_id` relationship makes Supabase return one object or `null`. Feed cards, post details, and editing now handle that shape. Existing posts and images are preserved; these fixes require an app deployment, **not a database reset or a new migration**.

Coaches and administrators can start from **Kampoppstilling** on the feed or schedule, select a match, then save a draft or publish. Publishing adds the lineup to the feed. Players cannot access the editor. Failed uploads retain the saved post ID so retrying does not create duplicates. Feed sections have independent error boundaries, and retry refetches their content.

Decorative slogans, redundant captions, and repeated footer text have been removed. Form guidance, permissions explanations, and error messages remain.

## Prerequisites

- Node.js **24 LTS** and npm (`.nvmrc` is included).
- A Supabase project, or the Supabase CLI and Docker for a local stack.
- GitHub and Vercel accounts only when publishing the repository/deploying. The app also supports standard Node hosting via `npm start`.

## Install and run

```sh
npm ci
cp .env.example .env.local
```

Edit `.env.local`:

| Variable                               | Purpose                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project URL from Supabase → Project Settings → API.                                                                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`), or the local/legacy anon key. Safe for the browser; RLS protects data.                         |
| `NEXT_PUBLIC_SITE_URL`                 | Exact app origin, e.g. `http://localhost:3000` or `https://ntnuivolleyballd2a.no`. Used in auth redirects.                           |
| `MAX_IMAGE_SIZE_MB`                    | Optional application upload limit; defaults to 3 MB to fit Vercel request limits; capped at the bucket's 10 MB limit on other hosts. |

The application **does not need a service-role key**. Never put one in `NEXT_PUBLIC_*`, source files, or browser code. Hosted Supabase connection details are not included in this repository.

### Hosted Supabase

1. Create one Supabase project, preferably near Norway.
2. Install the Supabase CLI using its official installation instructions.
3. Authenticate, link, and apply the migration:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Alternatively, execute `supabase/migrations/202609190001_initial.sql` once in the project's SQL Editor on an empty application schema. Do not re-run it on an already migrated database.

4. The migration creates tables, constraints, indexes, Auth signup trigger, RLS policies, RPCs, disabled notification rules, and the **private** `post-images` bucket. Do not make the bucket public.
5. Enable email/password sign-in. Set the minimum password length to 12 and enable email confirmation for production. Configure production SMTP in Supabase before inviting users.
6. Set Auth → URL Configuration → Site URL to the app origin. Add exact allowed redirects:

   ```text
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/callback?next=/auth/update-password
   https://ntnuivolleyballd2a.no/auth/callback
   https://ntnuivolleyballd2a.no/auth/callback?next=/auth/update-password
   ```

   The default Supabase email templates must retain `{{ .ConfirmationURL }}`. The callback exchanges the PKCE code using the initiating browser's cookies. If a confirmation link is opened in another browser, sign in again after confirmation.

7. Configure `.env.local`, then:

   ```sh
   npm run dev
   ```

8. Open `http://localhost:3000`, register, confirm the email if enabled, and bootstrap the first admin.

### Local Supabase

With Docker running:

```sh
supabase start
supabase db reset
supabase status
```

Copy the local API URL and publishable/anon key to `.env.local`. The checked-in `supabase/config.toml` disables email confirmation **only in the local stack**. `supabase db reset` deletes local data and reapplies migrations; never run it against production. No real credentials or user accounts are seeded.

## Bootstrap the first administrator

Register the intended account normally. In the secure Supabase SQL Editor, find its UUID:

```sql
select id, email from auth.users where email = 'YOUR_ADMIN_EMAIL';
```

Verify it is the intended account, then run with that UUID:

```sql
update public.profiles
set base_role = 'admin',
    account_status = 'approved',
    approved_at = now(),
    updated_at = now()
where id = 'REPLACE_WITH_VERIFIED_USER_UUID'::uuid;
```

Refresh the app. Administrasjon → Brukere og tilganger now allows approval as **Spiller** or **Trener**. No application endpoint can promote an admin or modify a protected admin account. Additional admins require the same secure database process.

## Development and tests

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

`npm test` applies the production SQL migration to PGlite, an embedded PostgreSQL engine, with minimal Supabase auth/storage schema shims. It tests real SQL permissions and RLS using separate `anon`/`authenticated` roles, not mocked authorization functions. It also tests validation, Oslo time conversion, and rendering posts with the actual object/null media shape. This does not test the hosted Supabase Auth or Storage HTTP services.

Browser and accessibility tests:

```sh
npx playwright install chromium
npm run test:e2e:local
npm run test:e2e
```

Public tests run at desktop and mobile widths and verify route protection, private image denial, registration/recovery forms, keyboard use, WCAG checks, and horizontal overflow. Screenshots are written to `test-results/`.

`test:e2e:local` runs both public and authenticated workflows without Docker or project credentials. It starts the real Next app on port 3100 and a loopback-only test adapter on port 54329. The adapter executes the production migration and RLS in PGlite and derives relationship cardinality from database constraints. Auth and Storage HTTP services are simulated; this catches application/rendering bugs but does not replace testing hosted Supabase. No application authentication bypass is added. The in-memory test database is discarded when the server stops.

Authenticated coverage includes post/image creation, private image access, editing, image removal, deletion, failed-upload retry, isolated feed errors, registration/approval, roster administration, event permissions, volunteer assignments, notifications, account disabling, and lineup drafts/publication/history/results. Failure-injection tests run only with the isolated adapter.

The full browser test (`tests/e2e/team.spec.ts`) registers a user, approves them from a separate admin session, writes a post, verifies role restrictions, and publishes a coach's lineup. It requires a **disposable** Supabase instance with the migration applied and email confirmation disabled. Configure the application's normal Supabase variables for that same instance and set these test-only environment variables in the test process:

```text
E2E_SUPABASE_URL=<test project URL>
E2E_SUPABASE_SERVICE_ROLE_KEY=<test-only privileged key>
E2E_BASE_URL=<optional already-running app origin>
```

Without the first two variables, `test:e2e` skips authenticated integration tests. Set `E2E_REQUIRE_BACKEND=1` to fail instead of skipping; CI and `test:e2e:local` enforce this. Hosted tests generate unique synthetic accounts and leave test data for inspection. Reset only the disposable test database afterward. **Never point these tests at the production project.** The privileged key is used exclusively by the Node test process to arrange fixtures and is never imported by app code.

The GitHub Actions workflow runs code checks, builds, the isolated browser suite, and a separate full Supabase integration job with local Docker services.

## Architecture and security

- Server Components fetch through a cookie-authenticated Supabase client. `proxy.ts` refreshes sessions; `requireAccount()` independently checks authentication and the current profile status before private data access.
- Every private table has RLS. Browser roles have safe `SELECT` grants and no direct table mutations. Reviewed `SECURITY DEFINER` RPCs enforce current account status, ownership, event category, and role context, with an empty `search_path`. Internal trigger/notification functions are not executable by API roles.
- Admin email lookup is a restricted RPC over `auth.users`. Profiles and roster queries have no email column.
- Post authors and role context are captured by the database. Post edits preserve historical context. Each lineup save creates a version; published player snapshots are never rewritten. The feed points to the current published version.
- Writes return Norwegian errors. Post/event edits compare `updated_at`; lineup saves lock the match and compare the latest revision to prevent silent overwrite.
- Images use generated paths in a private bucket. The server validates size/type, decodes and re-encodes accepted images, strips metadata, and serves media through `/media/[id]` with authentication and `private, no-store`. That endpoint also re-encodes direct API uploads. No public media URLs or shared image-optimizer caches are used.
- Notifications are created in the content transaction, so failed transactions cannot announce unpublished content. Disabled triggers produce no rows. Read state is owner-only, and authors are excluded from their own action notifications.
- The interface renders plain text; it does not accept HTML/Markdown scripts. Next.js handles Server Action origin checks. No auth credentials or tokens are logged.
- Disabling an account immediately blocks future database access. No hard-delete account workflow exists; history remains intact.

## Deliberate V1 choices

- Brand accents are provisional muted green/lime, centralized in `globals.css`; role/event labels and colors are centralized in `src/lib/domain.ts`.
- Local fonts are bundled with the app. No third-party font requests or external image services are required.
- `schedule_events.location` is the canonical venue; there is no redundant match venue field.
- Event category is immutable after creation. Delete/recreate an incorrectly categorized event if it has no lineup history.
- A match with any lineup history cannot be deleted. Record a cancellation in the title/description to preserve the match and revisions.
- Every lineup save creates a revision, including incomplete drafts. Coaches/admins see drafts; normal members see published versions only.
- Secondary-role event managers can manage only their own events while they retain the relevant role. Coaches share management of matches/practices.
- Changing player → coach clears live player data and secondary roles transactionally, preserving published snapshots. Multiple holders of a responsibility are allowed.
- Disabling a player removes active secondary roles but retains jersey/position records. A retained non-null jersey stays reserved until an admin clears it. This avoids silently reassigning numbers on reactivation.
- All times display in `Europe/Oslo`. Nonexistent spring-transition times are rejected. The ambiguous fall-transition hour follows `date-fns-tz`'s deterministic interpretation; choose an unambiguous time for events around that transition.
- The notification dropdown displays up to 50 rows, prioritizing unread notifications. Past records remain in the database.
- The default upload limit is 3 MB to fit [Vercel's 4.5 MB request limit](https://vercel.com/docs/functions/limitations), including multipart overhead. The bucket allows 10 MB for future direct-to-storage uploads. Raise the app limit only on hosting that supports larger request bodies.
- Failed media attachment leaves the successfully saved text post in place and explains how to retry. Cleanup attempts remove unattached objects; an interrupted network request can leave an orphan object for later administrative cleanup.
- Spond integration is not implemented without an API contract. External event IDs/source/sync timestamps are reserved in the schema and are not writable through normal event forms. A future import service should be a separate server adapter.

## Deploy to Vercel and the target domain

1. Create a GitHub repository and push these files, including `package-lock.json` and migrations. Do not commit `.env.local`.
2. Import the repository into Vercel as a Next.js project, with the project root as the root directory and Node.js 24.
3. Set the three required environment variables above for production. Use the production Supabase URL/key and `NEXT_PUBLIC_SITE_URL=https://ntnuivolleyballd2a.no`.
4. Apply migrations to the production Supabase project **before** deploying the app. Bootstrap the admin after registration.
5. Deploy using the default `npm run build` build command. No Vercel-specific data services are required.
6. Add `ntnuivolleyballd2a.no` in Vercel → Project → Settings → Domains. Apply the exact DNS records Vercel supplies at your domain registrar and wait for domain/TLS verification. Add `www` only if you want it and redirect it to the canonical domain.
7. Verify Supabase's production Site URL and callback allowlist match the final HTTPS domain. Preview deployments should use a separate test project and explicit callback URLs, not wildcard access to production.
8. Verify in two separate browsers: anonymous users reach only auth screens; new registrations stay pending; admin approval unlocks access; coach/player permissions differ; media is denied after sign-out; an enabled notification arrives only at its intended recipients.
9. Run the PostgreSQL authorization tests and the full browser workflow against a staging project before launch. Review Supabase's policy/table grants and confirm `post-images.public = false` after any subsequent migration.

Source implementation references: [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy), [Supabase server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), and [Supabase CLI local development](https://supabase.com/docs/guides/local-development/cli/getting-started).
