# Watched Rating Visibility & Inline Edit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show which user has already rated on each watched movie card, and let any user edit their existing rating inline.

**Architecture:** Two independent changes — (1) add a `PATCH /api/ratings` endpoint to update an existing rating row, and (2) rewrite `MovieCard` to track `localRatings` in state, display per-user status correctly for 0/1/2 ratings, and render an inline edit form when the Edit link is clicked.

**Tech Stack:** Next.js 14 API routes · Prisma (SQLite, `@@unique([movieId, user])` on `Rating`) · React client components · shadcn/ui Button + Textarea · Vitest

---

## File Map

| File | Change |
|---|---|
| `src/app/api/ratings/route.ts` | Add `PATCH` handler |
| `tests/api.ratings.test.ts` | Add `PATCH` tests; extend existing prisma mock |
| `src/components/movie-card.tsx` | Full rewrite — rating status display + inline edit state |

---

### Task 1: PATCH /api/ratings — tests first

**Files:**
- Modify: `tests/api.ratings.test.ts`
- Modify: `src/app/api/ratings/route.ts`

- [ ] **Step 1: Extend the prisma mock and add PATCH tests**

Replace the top of `tests/api.ratings.test.ts` (the `vi.mock` for `@/lib/db` and the imports) and add a new `describe` block. The full file becomes:

```typescript
// tests/api.ratings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    rating: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    movie: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/seerr', () => ({ deleteMedia: vi.fn() }))

import { prisma } from '@/lib/db'
import * as seerr from '@/lib/seerr'
import { POST as POST_RATING, PATCH as PATCH_RATING } from '@/app/api/ratings/route'
import { POST as POST_WATCHED } from '@/app/api/movies/[id]/watched/route'

const movie = {
  id: 1, title: 'Seven Samurai', tmdbId: 345911,
  seerrMediaId: '42', status: 'watchlist',
}

describe('POST /api/ratings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a rating and returns incomplete when only one rating exists', async () => {
    vi.mocked(prisma.rating.create).mockResolvedValue({
      id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'A masterpiece.', submittedAt: new Date(),
    } as any)
    vi.mocked(prisma.rating.findMany).mockResolvedValue([
      { user: 'user1', rating: 'up', quote: 'A masterpiece.' },
    ] as any)

    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'up', quote: 'A masterpiece.' }),
    })
    const res = await POST_RATING(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.complete).toBe(false)
    expect(data.ratings).toHaveLength(1)
  })

  it('returns complete=true when both users have rated', async () => {
    vi.mocked(prisma.rating.create).mockResolvedValue({
      id: 2, movieId: 1, user: 'user2', rating: 'down', quote: 'Not for me.', submittedAt: new Date(),
    } as any)
    vi.mocked(prisma.rating.findMany).mockResolvedValue([
      { user: 'user1', rating: 'up', quote: 'A masterpiece.' },
      { user: 'user2', rating: 'down', quote: 'Not for me.' },
    ] as any)

    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user2', rating: 'down', quote: 'Not for me.' }),
    })
    const res = await POST_RATING(req)
    const data = await res.json()
    expect(data.complete).toBe(true)
    expect(data.ratings).toHaveLength(2)
  })

  it('returns 422 for invalid rating value', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'sideways', quote: 'Hmm.' }),
    })
    expect((await POST_RATING(req)).status).toBe(422)
  })

  it('returns 422 for empty quote', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'up', quote: '   ' }),
    })
    expect((await POST_RATING(req)).status).toBe(422)
  })
})

describe('PATCH /api/ratings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates an existing rating and returns 200 with ratings array', async () => {
    vi.mocked(prisma.rating.update).mockResolvedValue({
      id: 1, movieId: 1, user: 'user1', rating: 'down', quote: 'Changed my mind.', submittedAt: new Date(),
    } as any)
    vi.mocked(prisma.rating.findMany).mockResolvedValue([
      { user: 'user1', rating: 'down', quote: 'Changed my mind.' },
      { user: 'user2', rating: 'up', quote: 'Still love it.' },
    ] as any)

    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'down', quote: 'Changed my mind.' }),
    })
    const res = await PATCH_RATING(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ratings).toHaveLength(2)
    expect(prisma.rating.update).toHaveBeenCalledWith({
      where: { movieId_user: { movieId: 1, user: 'user1' } },
      data: { rating: 'down', quote: 'Changed my mind.' },
    })
  })

  it('returns 404 when no prior rating exists', async () => {
    vi.mocked(prisma.rating.update).mockRejectedValue(new Error('Record not found'))

    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 99, user: 'user1', rating: 'up', quote: 'Great.' }),
    })
    const res = await PATCH_RATING(req)
    expect(res.status).toBe(404)
  })

  it('returns 422 for invalid user', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user3', rating: 'up', quote: 'Great.' }),
    })
    expect((await PATCH_RATING(req)).status).toBe(422)
  })

  it('returns 422 for invalid rating value', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'meh', quote: 'Hmm.' }),
    })
    expect((await PATCH_RATING(req)).status).toBe(422)
  })

  it('returns 422 for empty quote', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'up', quote: '  ' }),
    })
    expect((await PATCH_RATING(req)).status).toBe(422)
  })
})

describe('POST /api/movies/[id]/watched', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks movie as watched and triggers Seerr delete', async () => {
    vi.mocked(prisma.movie.findUnique).mockResolvedValue(movie as any)
    vi.mocked(prisma.movie.update).mockResolvedValue({ ...movie, status: 'watched' } as any)
    vi.mocked(seerr.deleteMedia).mockResolvedValue(true)

    const req = new Request('http://localhost/api/movies/1/watched', { method: 'POST' })
    const res = await POST_WATCHED(req, { params: { id: '1' } })
    expect(res.status).toBe(200)
    expect(seerr.deleteMedia).toHaveBeenCalledWith(42)
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'watched', watchedAt: expect.any(Date) },
    })
  })
})
```

- [ ] **Step 2: Run the new PATCH tests — expect them to fail**

```bash
npm run test:run -- --reporter=verbose tests/api.ratings.test.ts
```

Expected: the four `PATCH /api/ratings` tests fail with `PATCH_RATING is not a function` (or similar import error). The existing POST and watched tests still pass.

- [ ] **Step 3: Add the PATCH handler to the ratings route**

Replace the full content of `src/app/api/ratings/route.ts`:

```typescript
// src/app/api/ratings/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { USER_KEYS } from '@/lib/users'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { movieId, user, rating, quote } = body

  if (!USER_KEYS.includes(user)) {
    return NextResponse.json({ error: 'invalid user' }, { status: 422 })
  }
  if (!['up', 'down'].includes(rating)) {
    return NextResponse.json({ error: 'rating must be "up" or "down"' }, { status: 422 })
  }
  if (!quote?.trim()) {
    return NextResponse.json({ error: 'quote required' }, { status: 422 })
  }

  await prisma.rating.create({
    data: { movieId, user, rating, quote: quote.trim() },
  })

  const ratings = await prisma.rating.findMany({ where: { movieId } })
  const complete = ratings.length === 2

  return NextResponse.json({ complete, ratings }, { status: 201 })
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { movieId, user, rating, quote } = body

  if (!USER_KEYS.includes(user)) {
    return NextResponse.json({ error: 'invalid user' }, { status: 422 })
  }
  if (!['up', 'down'].includes(rating)) {
    return NextResponse.json({ error: 'rating must be "up" or "down"' }, { status: 422 })
  }
  if (!quote?.trim()) {
    return NextResponse.json({ error: 'quote required' }, { status: 422 })
  }

  try {
    await prisma.rating.update({
      where: { movieId_user: { movieId, user } },
      data: { rating, quote: quote.trim() },
    })
  } catch {
    return NextResponse.json({ error: 'rating not found' }, { status: 404 })
  }

  const ratings = await prisma.rating.findMany({ where: { movieId } })
  return NextResponse.json({ ratings }, { status: 200 })
}
```

- [ ] **Step 4: Run all tests — all should pass**

```bash
npm run test:run
```

Expected: `78 passed` → now `83 passed` (5 new PATCH tests). Zero failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ratings/route.ts tests/api.ratings.test.ts
git commit -m "feat: add PATCH /api/ratings to update an existing rating"
```

---

### Task 2: MovieCard — rating status display + inline edit

**Files:**
- Modify: `src/components/movie-card.tsx`

- [ ] **Step 1: Replace `MovieCard` with the new implementation**

Replace the full content of `src/components/movie-card.tsx`:

```typescript
// src/components/movie-card.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import { ThumbRating } from './thumb-rating'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Movie, Rating, User, RatingValue } from '@/types'

type CleanupState = 'idle' | 'loading' | 'done' | 'error'

interface MovieCardProps {
  movie: Movie
  userNames: Record<User, string>
}

export function MovieCard({ movie, userNames }: MovieCardProps) {
  const [cleanupState, setCleanupState] = useState<CleanupState>('idle')
  const [localRatings, setLocalRatings] = useState<Rating[]>(movie.ratings ?? [])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editRating, setEditRating] = useState<RatingValue | undefined>(undefined)
  const [editQuote, setEditQuote] = useState('')
  const [saving, setSaving] = useState(false)

  const bothRated = localRatings.length === 2
  const agreed = bothRated && localRatings[0].rating === localRatings[1].rating

  const openEdit = (user: User) => {
    const existing = localRatings.find((r) => r.user === user)
    setEditingUser(user)
    setEditRating(existing?.rating as RatingValue | undefined)
    setEditQuote(existing?.quote ?? '')
  }

  const cancelEdit = () => {
    setEditingUser(null)
    setEditRating(undefined)
    setEditQuote('')
  }

  const saveEdit = async () => {
    if (!editingUser || !editRating || !editQuote.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/ratings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieId: movie.id,
          user: editingUser,
          rating: editRating,
          quote: editQuote.trim(),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setLocalRatings(data.ratings)
        cancelEdit()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCleanup = async () => {
    if (cleanupState === 'loading') return
    setCleanupState('loading')
    try {
      const res = await fetch(`/api/movies/${movie.id}/seerr`, { method: 'DELETE' })
      const data = await res.json()
      setCleanupState(data.ok ? 'done' : 'error')
    } catch {
      setCleanupState('error')
    }
  }

  const renderRatingRow = (user: User) => {
    const r = localRatings.find((rated) => rated.user === user)
    const hasRated = !!r

    if (editingUser === user) {
      return (
        <div key={user} className="bg-amber-50 rounded-lg p-2 space-y-2">
          <span className="text-xs font-semibold text-amber-900">{userNames[user]}</span>
          <ThumbRating value={editRating} onChange={setEditRating} size="sm" />
          <Textarea
            value={editQuote}
            onChange={(e) => setEditQuote(e.target.value)}
            className="border-amber-300 focus:ring-amber-400 resize-none text-xs"
            rows={2}
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              className="flex-1 h-6 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              onClick={saveEdit}
              disabled={saving || !editRating || !editQuote.trim()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-6 text-xs border-stone-200 text-stone-500"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )
    }

    if (!hasRated) {
      return (
        <div key={user} className="bg-stone-50 rounded-lg p-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-400">{userNames[user]}</span>
          <span className="text-xs text-stone-300">—</span>
        </div>
      )
    }

    return (
      <div key={user} className="bg-amber-50 rounded-lg p-2">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-xs font-semibold text-amber-900">{userNames[user]}</span>
          <div className="flex items-center gap-1.5">
            {bothRated ? (
              <ThumbRating value={r.rating as RatingValue} readonly size="sm" />
            ) : (
              <span className="text-xs text-green-600">✓</span>
            )}
            <button
              onClick={() => openEdit(user)}
              className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
        {bothRated && (
          <p className="text-xs text-stone-500 italic line-clamp-2">&ldquo;{r.quote}&rdquo;</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] bg-amber-100">
        {movie.posterUrl ? (
          <Image src={movie.posterUrl} alt={movie.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-300 text-4xl">🎥</div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-bold text-stone-900 text-sm leading-tight mb-0.5">
          {movie.title}
          {process.env.NEXT_PUBLIC_SEERR_URL && (
            <a
              href={`${process.env.NEXT_PUBLIC_SEERR_URL}/movie/${movie.tmdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-amber-500 hover:text-amber-700 transition-colors font-normal text-xs"
              title="View in Seerr"
            >
              ↗
            </a>
          )}
        </h3>
        <div className="flex items-center justify-between mb-3">
          <p className="text-stone-400 text-xs">{movie.year}</p>
          {bothRated && (
            <span className="text-xs text-stone-400" title={agreed ? 'You agreed' : 'You disagreed'}>
              {agreed ? '🤝' : '⚔️'}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {(['user1', 'user2'] as User[]).map((user) => renderRatingRow(user))}
        </div>

        {/* Cleanup button — only shown when movie has a Seerr entry */}
        {movie.seerrMediaId && (
          <div className="mt-2 pt-2 border-t border-amber-100 text-center">
            {cleanupState === 'idle' && (
              <button
                onClick={handleCleanup}
                className="text-xs text-stone-400 hover:text-red-400 transition-colors"
              >
                🧹 Clean up from Plex
              </button>
            )}
            {cleanupState === 'loading' && (
              <p className="text-xs text-stone-400">Cleaning up…</p>
            )}
            {cleanupState === 'done' && (
              <p className="text-xs text-green-600">Cleaned up ✓</p>
            )}
            {cleanupState === 'error' && (
              <button
                onClick={handleCleanup}
                className="text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                Failed — try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm run test:run
```

Expected: all 83 tests pass. (MovieCard is a client component with no dedicated unit tests — correctness is verified by TypeScript + manual review.)

- [ ] **Step 3: Type-check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/movie-card.tsx
git commit -m "feat: show per-user rating status and inline edit on watched cards"
```
