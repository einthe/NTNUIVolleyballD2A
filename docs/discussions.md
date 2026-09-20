# Comments and meme reactions

Every post (including published lineups) and every event has a discussion section on its detail page. Feed and schedule cards do not show comment/reaction controls. Approved players, coaches and admins can participate.

Comments support nested replies, connecting thread lines, links typed as normal text, and 3,000 characters per comment. Authors can edit/delete their comments; admins can delete any comment. Deletion removes the body and preserves a placeholder and its replies. Replies link back to their parent. Indentation stops growing on small screens, while parent links preserve context. The database caps nesting at 32 replies; deeper conversations can continue under an earlier comment.

Reactions use GIFs selected through GIPHY, with no emoji or upload alternative. Users can select multiple different memes, once each per post/event. Identical memes are grouped with a count and the names of everyone who reacted displayed below each meme. Clicking a selected reaction removes your reaction. GIFs play automatically in the picker and reactions section. **Skjul reaksjoner** hides the section and unmounts its GIFs to stop playback; **Vis reaksjoner** opens it again. Comments remain visible. GIPHY availability does not affect comments.

## Setup

1. Apply `supabase/migrations/202609200006_discussions.sql` to the connected Supabase project before deploying the app (`supabase db push` for a linked project). This adds tables/functions without resetting existing data.
2. Sign in at [GIPHY Developers](https://developers.giphy.com/dashboard/), create an **API** key for the web app, and add this to `.env.local`:

   ```env
   NEXT_PUBLIC_GIPHY_API_KEY=your_api_key
   ```

3. Restart `npm run dev` locally. For deployment, add the same environment variable to the hosting project's settings and rebuild/redeploy; `NEXT_PUBLIC_` values are embedded at build time.

GIPHY requires direct browser requests, so this is intentionally a public browser key, not a server secret. Do not commit `.env.local`. New beta keys are currently limited to 100 API calls/hour; check the [official quickstart and production upgrade process](https://developers.giphy.com/docs/api/) for current limits and requirements. A search, a search page, or resolving stored GIF IDs consumes API calls.

Without a configured key, comments remain available and the meme button displays as unavailable. Provider/network/rate-limit errors include retry feedback. Automated tests intercept only GIPHY browser requests; the configured local key was also verified manually with live search, image loading and reaction persistence.

## Storage and permissions

- `discussion_comments` and `meme_reactions` belong to exactly one post or event, with cascading deletion when that content is removed.
- Authenticated reads require an approved account through RLS. Writes use guarded RPCs; direct table writes are denied.
- Comment parent/target consistency, ownership, version checks, body limits and reaction uniqueness are enforced in PostgreSQL, independently of the UI. New comments use request IDs to avoid duplicate submissions on retry.
- Only GIPHY IDs are persisted, never GIF URLs/files. The browser retrieves current metadata directly from GIPHY and uses media URLs unchanged. No media proxy, Next image optimization, persisted metadata cache or downloaded GIF copies are used. Search terms are sent as entered, results retain API order, and the rating is `pg-13`.
- The logo graphic is replaced by a small **Powered by GIPHY** text link in the picker and expanded reactions section to retain visible provider attribution.
- Discussion data follows account-scoped query caching, refreshes on focus and every 30 seconds while visible, and is invalidated immediately after a successful change. GIPHY metadata uses transient component state rather than the app's shared query cache.
- This feature does not add notification triggers for comments or reactions.

## Local demo and verification

Restart `npm run dev` to apply the migration to the disposable local database. **Baneoppsett til helgen** has an example thread with nested replies, and **NTNUI – Fjordvik** has an example comment. Add your GIPHY key to test actual meme search; demo code is not included in deployment.

- `npm test`: PostgreSQL/RLS tests cover approved/unapproved access, ownership, admin moderation, stale edits, cross-target replies, idempotent requests, reaction uniqueness, nesting limits and cascading deletion. Unit tests cover thread construction and safe media URLs.
- `npm run test:e2e:local -- tests/e2e/discussions.spec.ts`: uses real app actions and a disposable PostgreSQL backend on desktop/mobile; GIPHY API/media requests alone are mocked with an explicit test-only key. Covers search, pagination, rate limits, replies, editing, links, deletion, reaction counts/removal, persistence, event discussions and provider failures.

To run the same isolated browser tests against Next development mode (including React Strict Mode), use `E2E_NEXT_DEV=1 npm run test:e2e:local -- tests/e2e/discussions.spec.ts`. This catches dialog lifecycle regressions that can differ from production builds.
