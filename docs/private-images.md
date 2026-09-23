# Private image delivery

Admins can turn automatic image sizing on/off under **Administrasjon →
Bildeinnstillinger**. This is a team-wide database setting, enabled by default.
When off, avatars request the 512 px version and posts request the 2400 px version
without a responsive source set. Caching, validation and authorization stay on.
Saving refreshes the admin's session immediately; other open pages refresh their
session/settings every 30 seconds while visible, or on reload.

Apply `supabase/migrations/202609210001_image_settings.sql` for this toggle. Local
demo/test databases apply it automatically on startup. Until it is applied, image
sizing remains enabled and the app stays usable; the admin settings page offers
retry rather than pretending a setting was saved.

Post photos and avatars stay in private Supabase buckets. No public image URLs,
signed download links, or public Next image optimizer are introduced.

## Processing and sizes

Uploads retain the existing server-side size/type/pixel validation, orientation
correction, metadata stripping and WebP encoding. After upload, the server primes
Next's Data Cache with WebP variants from those validated bytes:

- Avatars: 64, 128, 256 and 512 px square.
- Posts: 480, 960, 1600 and 2400 px bounding boxes, without enlarging the source.

Images use `srcset` and `sizes` so the browser selects a suitable resolution for
the displayed size and pixel density. Post images retain lazy loading. Both image
types use asynchronous decoding. Existing/direct API uploads pass through the
same decoding and validation on their first variant request; a filename or MIME
type alone never makes uploaded bytes trusted.

## Loading and layout stability

Post photos show a palette-aware placeholder with a spinner and “Laster bilde …”
until loaded. Uploads store the dimensions of the final, orientation-corrected
image so single-image posts reserve the right aspect ratio before fetching bytes.
Older images without dimensions and multi-image galleries use a stable 4:3 frame.
Frames retain the existing 600 px height limit and contain the whole image.
Loading or failing images do not change the frame size; failed post images offer
“Prøv igjen”. Avatars and GIFs also show placeholders in their fixed-size frames.
Placeholder animations respect reduced-motion preferences.

Apply `202609230003_post_image_dimensions.sql` with `npx supabase db push` before
deploying this update. It preserves existing attachments; no image downloads or
backfill are needed. The local demo applies it automatically on restart.

## Two separate caches

The **server Data Cache** stores only re-encoded image bytes. Keys include the
Supabase project, bucket kind, storage path, live storage object ID/version/ETag,
requested size and encoding version. It does not cache permission decisions,
cookies or entire authenticated HTTP responses. Normal replacement/removal
actions also expire all variant tags for the old path.

Every `/media/[id]` and `/avatars/[id]` request first checks the current account,
the current attachment record under RLS, and live Storage metadata under the
viewer's credentials. These checks use uncached requests. A removed attachment,
missing source or disabled account cannot retrieve cached bytes. A source version
change selects a new cache entry, including deletion/recreation at the same path.
Cold generation checks the source version again before storing a result.

The **browser cache** receives `private, no-cache, must-revalidate`, an ETag and
`Vary: Cookie, Authorization`. The ETag includes the viewer and encoded content.
After authorization and source checks, unchanged conditional requests receive
`304` with no body. There is no time window allowing fresh browser-cache reuse
without revalidation. Failed/denied requests use `private, no-store`.

As with any previously viewed content, browser history snapshots or files a user
has already saved cannot be remotely erased by HTTP cache policy.

## Deployment and limits

The image cache itself needs no schema migration or additional secret; the admin
toggle and dimension metadata use the migrations listed above.
Existing images are optimized on demand. Cache priming failure does not undo a
successful upload. Cache read/write failure falls back to validated processing.
Next's persistent Data Cache availability and entry-size limits depend on the
host. Evicted entries are regenerated; especially large full-size variants may
need to be regenerated when they exceed the host's cache limit. Smaller variants
and browser conditional requests still work.

Run `npm test -- tests/private-images.test.ts` for cache/access regression tests,
and `npm run test:e2e:local -- tests/e2e/private-images.spec.ts tests/e2e/profile.spec.ts`
for production-build browser checks against the disposable backend.
