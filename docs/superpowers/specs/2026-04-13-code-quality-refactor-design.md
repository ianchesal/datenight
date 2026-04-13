# Code Quality Refactor — Design Spec

**Date:** 2026-04-13  
**Scope:** Option B — surgical fixes + shared utility extraction  
**Goal:** Eliminate real duplication, remove dead code, and fix two correctness issues without changing app architecture or behavior.

---

## Changes

### 1. Remove dead dependencies

`@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` are in `package.json` `dependencies` but have zero imports anywhere in the source tree. Remove all three.

`@eslint/eslintrc` is in `dependencies` but is a dev-only ESLint tool. Move it to `devDependencies`.

**Files changed:** `package.json`  
**Test coverage:** N/A — build and TypeScript would fail immediately if packages were actually used.

---

### 2. Parallelize Seerr API calls in sync.ts

`src/lib/sync.ts` contains two sequential `for` loops that hit the Seerr API one movie at a time:

- Loop 1: `for (const movie of toRequest)` — calls `requestMovie()` serially
- Loop 2: `for (const movie of requested)` — calls `getMovieStatus()` serially

Replace both with `Promise.all()`. The behavior (which movies are processed, what DB updates are made) is identical; only the execution order changes from serial to parallel.

**Files changed:** `src/lib/sync.ts`  
**Test coverage:** `tests/sync.test.ts` — mocks verify correct calls and DB updates, agnostic to call ordering.

---

### 3. Fix type misalignment and remove anti-pattern in watched/page.tsx

**Type cast:** `<WatchedClient movies={movies as unknown as Movie[]} ... />` exists because Prisma returns `createdAt` and `watchedAt` as `Date` objects but `Movie` in `src/types/index.ts` declares them as `string`. Fix by widening those two fields in the `Movie` type to `Date | string`. Drop the cast.

**Anti-pattern:** `Promise.resolve(getUserNames())` wraps a synchronous function in a Promise unnecessarily. Call `getUserNames()` directly outside the `Promise.all`.

**Files changed:** `src/types/index.ts`, `src/app/watched/page.tsx`  
**Test coverage:** TypeScript compiler catches the type change. `tests/watched-client.test.tsx` covers component behavior.

---

### 4. Extract `formatRuntime()` utility

The expression `${Math.floor(runtime / 60)}h ${runtime % 60}m` appears inline in three places:

- `src/components/movie-row.tsx:74`
- `src/app/add/page.tsx:102`
- `src/app/recommendations/page.tsx:231`

Add `export function formatRuntime(minutes: number): string` to `src/lib/utils.ts` alongside `cn()`. Replace all three callsites.

**Files changed:** `src/lib/utils.ts`, `src/components/movie-row.tsx`, `src/app/add/page.tsx`, `src/app/recommendations/page.tsx`  
**Test coverage:** No existing tests for runtime display strings. Change is a pure extraction of a deterministic math expression; TypeScript enforces the call signature.

---

### 5. Extract `<MoviePoster>` component

The "poster image or 🎥 emoji placeholder" block is duplicated across three components with slightly different container dimensions:

- `src/components/movie-row.tsx` — `w-9 h-14` (small)
- `src/components/movie-card.tsx` — `w-full aspect-[2/3]` with `fill` layout (large)
- `src/app/recommendations/page.tsx` — `w-16 h-24` (medium)

Create `src/components/movie-poster.tsx` with a `size` prop (`'sm' | 'md' | 'lg'`) that maps to the three container sizes. The component renders the `next/image` when `posterUrl` is set, otherwise renders the placeholder. Replace all three callsites.

**Files changed:** `src/components/movie-poster.tsx` (new), `src/components/movie-row.tsx`, `src/components/movie-card.tsx`, `src/app/recommendations/page.tsx`  
**Test coverage:** `tests/movie-card.test.tsx` mocks `next/image` and tests card behavior — extraction does not affect these tests.

---

### 6. Extract validation helper in ratings/route.ts

`POST` and `PATCH` in `src/app/api/ratings/route.ts` share an identical 12-line validation block:

```ts
if (!USER_KEYS.includes(user)) { ... }
if (!['up', 'down'].includes(rating)) { ... }
if (!quote?.trim()) { ... }
```

Extract to a private `validateRatingBody()` function at the top of the file. It returns `NextResponse` on failure or `null` on success. Both handlers call it and early-return on non-null.

**Files changed:** `src/app/api/ratings/route.ts`  
**Test coverage:** `tests/api.ratings.test.ts` — all validation paths (invalid user, invalid rating value, empty quote) are tested for both POST and PATCH.

---

### 7. Fix Prisma error detection in ratings/route.ts

The current P2025 check in the `PATCH` handler is fragile:

```ts
const isNotFound =
  err instanceof Error &&
  'code' in err &&
  (err as { code: string }).code === 'P2025'
```

Replace with the proper Prisma SDK type:

```ts
import { Prisma } from '@prisma/client'
// ...
if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025')
```

The test mock in `tests/api.ratings.test.ts` also needs updating: replace `Object.assign(new Error(), { code: 'P2025' })` with a proper `Prisma.PrismaClientKnownRequestError` instance so the `instanceof` check passes. The constructor requires `(message, { code, clientVersion })` — use `'7.0.0'` as a placeholder `clientVersion`.

**Files changed:** `src/app/api/ratings/route.ts`, `tests/api.ratings.test.ts`  
**Test coverage:** `tests/api.ratings.test.ts` — the P2025 → 404 path is explicitly tested and will validate the change.

---

## What this does NOT change

- App architecture (no new layers, no route restructuring)
- Component boundaries (sidebar, watchlist page, add page structure unchanged)
- Any user-visible behavior
- Test count (no tests removed; one test mock updated)

## Success criteria

- `npm run test:run` passes with all 68 tests green after every change
- `npm run build` succeeds
- `npm run lint` is clean
