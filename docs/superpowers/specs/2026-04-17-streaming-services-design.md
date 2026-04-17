# Streaming Services Feature Design

**Date:** 2026-04-17  
**Branch:** ian/streaming-service-support  
**Status:** Approved — ready for implementation

## Overview

Add streaming service awareness to the Date Night watchlist. Users configure which streaming services they subscribe to; the app checks TMDB's Watch Providers API to discover if watchlist movies are available on those services. Streamable movies are marked ready to watch immediately, show "Watch on X" buttons, and can be filtered as a group.

---

## Data Model

### New Prisma model: `StreamingProvider`

```prisma
model StreamingProvider {
  id           Int    @id @default(autoincrement())
  movieId      Int
  providerId   Int
  providerName String
  movie        Movie  @relation(fields: [movieId], references: [id], onDelete: Cascade)

  @@unique([movieId, providerId])
}
```

Stores one record per movie-provider pair. `providerId` is TMDB's numeric provider ID (e.g. 8 = Netflix). Cascades on movie delete.

### Changes to `Movie` model

Add two fields:

```prisma
streamingLastChecked DateTime?
streamingLink        String?
```

- `streamingLastChecked` — when providers were last fetched for this movie. Null = never checked. Used to drive refresh logic.
- `streamingLink` — the TMDB regional watch page URL returned by the Watch Providers API (one URL per movie+region). All "Watch on X" buttons link here.

### New Settings keys

| DB key | AppConfig key | Default | Description |
|---|---|---|---|
| `streaming_region` | `streamingRegion` | `"US"` | ISO 3166-1 alpha-2 region code |
| `streaming_services` | `streamingServices` | `"[]"` | JSON array of TMDB provider IDs the user subscribes to |

### Logo assets

Streaming service logos are downloaded from TMDB's image CDN (`https://image.tmdb.org/t/p/w45/{logo_path}`) and stored as static files at `public/streaming-logos/{providerId}.png`. Downloads are skipped if the file already exists. Logos are served by Next.js as static assets — no CDN dependency at runtime.

---

## TMDB Integration

All new TMDB functions go in `src/lib/tmdb.ts`.

### `fetchWatchProviders(tmdbId: number, region: string)`

Calls `GET /movie/{tmdbId}/watch/providers`. Returns:

```ts
{
  link: string                                         // TMDB watch page URL
  flatrate: { providerId: number; providerName: string; logoPath: string }[]
}
```

Only `flatrate` (subscription streaming) is used. Rent and buy results are ignored.

### `fetchProviderList(region: string)`

Calls `GET /watch/providers/movie?watch_region={region}`. Returns the full list of streaming providers available in the region. Used by the Settings UI to render the provider checkbox grid.

---

## Streaming Sync Logic

New file: `src/lib/streaming.ts`

### `downloadProviderLogo(providerId: number, logoPath: string): Promise<void>`

Downloads `https://image.tmdb.org/t/p/w45/{logoPath}` to `public/streaming-logos/{providerId}.png`. No-ops if the file already exists.

### `syncMovieProviders(movieId: number, tmdbId: number): Promise<void>`

1. Reads `streamingRegion` from config.
2. Calls `fetchWatchProviders(tmdbId, region)`.
3. If the API returns no data (movie not found in region, or error): updates `streamingLastChecked` to now, returns — no providers stored. Movie falls back to "Not Streaming" state.
4. Downloads any missing logos via `downloadProviderLogo`.
5. Upserts `StreamingProvider` records (delete existing for movieId, insert fresh set).
6. Updates `Movie.streamingLastChecked = now()` and `Movie.streamingLink = link`.

### `refreshStaleProviders(): Promise<void>`

Finds all watchlist movies where `streamingLastChecked` is null OR older than 12 hours. Calls `syncMovieProviders` for each. Called by the cron job.

### Trigger points

| When | Action |
|---|---|
| Movie added (`POST /api/movies`) | Call `syncMovieProviders` immediately (fire-and-forget, non-blocking) |
| Cron job in `server.ts` | Add `0 */12 * * *` schedule calling `refreshStaleProviders()` |

---

## API Changes

### `src/lib/config.ts`

Add `streamingRegion` and `streamingServices` to `AppConfig`, `DEFAULTS`, `KEY_MAP`, and ensure they flow through `getConfig()`. `streamingServices` defaults to `"[]"`.

### `GET /api/movies`

Extend each movie in the response to include:

```ts
streamingProviders: { providerId: number; providerName: string }[]
streamingLink: string | null
```

Populated via Prisma `include: { streamingProviders: true }`.

### `GET /api/config`

Add `streamingRegion` and `streamingServices` to the public config response so the watchlist client knows which provider IDs the user has configured.

### `GET /api/streaming-providers` (new route)

Returns the full provider list for the configured region. Used by the Settings UI.

```ts
// Response
{ providerId: number; providerName: string; logoPath: string }[]
```

Triggers `downloadProviderLogo` for any missing logos as a side effect.

---

## Settings UI

New "Streaming" section in `SettingsForm`, placed below the Plex section:

- **Region** — text input (e.g. `"US"`), maps to `streaming_region`. Changing the region and saving triggers a background re-fetch of the provider list.
- **Your Streaming Services** — a grid of provider cards fetched from `GET /api/streaming-providers`. Each card shows the cached logo (`/streaming-logos/{providerId}.png`) and provider name. Cards toggle on/off. Selected provider IDs are serialized to a JSON array and saved to `streaming_services` via the existing `PUT /api/settings` endpoint.

---

## Watchlist UI

### Filter bar

A `Streamable` button is appended to the existing `STATUS_BUTTONS` array in `watchlist/page.tsx`. The filter logic: `m.streamingProviders.some(p => userServiceIds.includes(p.providerId))`.

### `MovieRow` — three states

The right-side action column has four rows in all states:

| Row | Content |
|---|---|
| 1 | Pills: `Streaming` or `Not Streaming` (green/grey) + seerr status pill (`Not Requested`, `Queued`, `Downloading`, `Ready`) |
| 2 | Stream buttons: `Watch on X` per matching provider (only shown when streamable) |
| 3 | Action buttons side-by-side (see table below) |
| 4 | `✕` remove button — alone on its own row in all states |

**Action buttons by state:**

| State | Condition | Row 3 buttons |
|---|---|---|
| A | Streamable, not in Plex | `Mark Watched` + `Download Now` |
| B | Streamable + in Plex (seerr: available) | `Mark Watched` + `Download Now` |
| C | Not streamable, not in Plex | `Download Now` |
| (existing) | Not streamable, in Plex (seerr: available) | `Mark Watched` |

A movie is considered "streamable" if its `streamingProviders` list contains at least one provider that matches the user's configured `streamingServices`.

**"Watch on X" buttons** link to `Movie.streamingLink` (the TMDB regional watch page). All provider buttons for a movie share the same link — this is the closest to a direct deep link that the TMDB API provides.

**Logo images** use `<img src="/streaming-logos/{providerId}.png" />` with a text fallback if the image fails to load.

---

## Error Handling

- **TMDB API error or no providers for region:** `syncMovieProviders` updates `streamingLastChecked` to now and stores no providers. The movie shows "Not Streaming" and retries on the next cron run.
- **Logo download failure:** Logged but non-fatal. The "Watch on X" button renders with text only.
- **`streaming_services` empty or unconfigured:** All movies show "Not Streaming". "Streamable" filter returns an empty list. No crash.
- **`streaming_region` not set:** Defaults to `"US"`.

---

## Testing

- Unit test `syncMovieProviders` with a mocked TMDB response: verifies `StreamingProvider` upsert, `streamingLastChecked` updated, logo download skipped when file exists.
- Unit test `refreshStaleProviders`: verifies only movies with `streamingLastChecked` null or >12h old are targeted.
- Unit test `GET /api/movies` response shape: verifies `streamingProviders` array present on each movie.
- No new UI component tests (consistent with existing test approach).
