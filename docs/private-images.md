# Private image delivery

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

Deploy the app normally; no schema migration or additional secret is needed.
Existing images are optimized on demand. Cache priming failure does not undo a
successful upload. Cache read/write failure falls back to validated processing.
Next's persistent Data Cache availability and entry-size limits depend on the
host. Evicted entries are regenerated; especially large full-size variants may
need to be regenerated when they exceed the host's cache limit. Smaller variants
and browser conditional requests still work.

Run `npm test -- tests/private-images.test.ts` for cache/access regression tests,
and `npm run test:e2e:local -- tests/e2e/private-images.spec.ts tests/e2e/profile.spec.ts`
for production-build browser checks against the disposable backend.
