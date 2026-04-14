# Watched Review Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a click-to-expand modal on watched movie cards that shows both users' full, untruncated reviews side by side.

**Architecture:** A new `MovieReviewModal` component (shadcn Dialog) is rendered inside `MovieCard`. The card's poster and title/header area become a click trigger that opens the modal. The modal is read-only but includes "Edit" links that close the modal and hand off to the existing `EditRatingDialog`. No new API endpoints.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui Dialog, Vitest + React Testing Library (jsdom)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/movie-review-modal.tsx` | Create | Read-only modal showing both users' full reviews |
| `src/components/movie-card.tsx` | Modify | Add `reviewModalOpen` state, click trigger on poster/header, `stopPropagation` on existing buttons, render modal |
| `tests/movie-review-modal.test.tsx` | Create | Unit tests for MovieReviewModal |
| `tests/movie-card-review-modal.test.tsx` | Create | Integration tests for card click → modal open |

---

## Task 1: Create MovieReviewModal component

**Files:**
- Create: `src/components/movie-review-modal.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/movie-review-modal.tsx` with this content:

```tsx
// src/components/movie-review-modal.tsx
'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MoviePoster } from './movie-poster'
import { ThumbRating } from './thumb-rating'
import type { Movie, Rating, User, RatingValue } from '@/types'

interface MovieReviewModalProps {
  movie: Movie
  ratings: Rating[]
  userNames: Record<User, string>
  open: boolean
  onClose: () => void
  onEditUser: (user: User) => void
}

export function MovieReviewModal({
  movie,
  ratings,
  userNames,
  open,
  onClose,
  onEditUser,
}: MovieReviewModalProps) {
  const r1 = ratings.find((r) => r.user === 'user1')
  const r2 = ratings.find((r) => r.user === 'user2')
  const bothRated = !!r1 && !!r2
  const agreed = bothRated && r1.rating === r2.rating

  const renderReviewPanel = (user: User, rating: Rating | undefined) => {
    if (!rating) {
      return (
        <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
          <p className="text-xs font-bold text-stone-400 mb-2">{userNames[user]}</p>
          <p className="text-sm text-stone-400 italic">No review yet</p>
        </div>
      )
    }
    return (
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-amber-900">{userNames[user]}</span>
          <ThumbRating value={rating.rating as RatingValue} readonly size="sm" />
        </div>
        <p className="text-sm text-stone-600 italic leading-relaxed">
          &ldquo;{rating.quote}&rdquo;
        </p>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex gap-4 items-start">
            <MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="md" />
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-stone-900 leading-tight mb-1">
                {movie.title}
              </DialogTitle>
              <p className="text-sm text-stone-400 mb-2">{movie.year}</p>
              {bothRated && (
                <span className="inline-flex items-center gap-1.5 bg-stone-100 rounded-full px-2.5 py-1 text-xs font-medium text-stone-600">
                  {agreed ? '🤝 You agreed' : '⚔️ You disagreed'}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {ratings.length === 0 ? (
          <p className="text-sm text-stone-400 italic text-center py-6">No reviews yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-2">
            {renderReviewPanel('user1', r1)}
            {renderReviewPanel('user2', r2)}
          </div>
        )}

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <div className="flex gap-3">
            <button
              onClick={() => onEditUser('user1')}
              className="text-xs text-stone-400 hover:text-amber-600 transition-colors"
            >
              Edit {userNames.user1}&apos;s review
            </button>
            <button
              onClick={() => onEditUser('user2')}
              className="text-xs text-stone-400 hover:text-amber-600 transition-colors"
            >
              Edit {userNames.user2}&apos;s review
            </button>
          </div>
          <Button size="sm" onClick={onClose} className="bg-amber-500 hover:bg-amber-600 text-white">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ian/src/ianchesal/datenight && npx tsc --noEmit
```

Expected: No errors. Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/components/movie-review-modal.tsx
git commit -m "feat: add MovieReviewModal component"
```

---

## Task 2: Test MovieReviewModal

**Files:**
- Create: `tests/movie-review-modal.test.tsx`

- [ ] **Step 1: Write the tests**

Create `tests/movie-review-modal.test.tsx`:

```tsx
// tests/movie-review-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MovieReviewModal } from '@/components/movie-review-modal'
import type { Movie, Rating } from '@/types'

// next/image doesn't work in jsdom — render a plain img instead
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

const movie: Movie = {
  id: 1,
  title: 'The Grand Illusion',
  year: 1937,
  runtime: 114,
  description: '',
  posterUrl: '/poster.jpg',
  imdbId: 'tt0029050',
  tmdbId: 12345,
  sortOrder: 0,
  status: 'watched',
  seerrStatus: 'available',
  createdAt: '2024-01-01',
}

const userNames = { user1: 'Alice', user2: 'Bob' }

const ratings: Rating[] = [
  { id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'A masterpiece of world cinema.', submittedAt: '2024-01-01' },
  { id: 2, movieId: 1, user: 'user2', rating: 'up', quote: 'Deeply moving from start to finish.', submittedAt: '2024-01-01' },
]

describe('MovieReviewModal', () => {
  const onClose = vi.fn()
  const onEditUser = vi.fn()

  beforeEach(() => {
    onClose.mockClear()
    onEditUser.mockClear()
  })

  it('shows the movie title and year', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('The Grand Illusion')).toBeInTheDocument()
    expect(screen.getByText('1937')).toBeInTheDocument()
  })

  it('shows both users full review quotes', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText(/A masterpiece of world cinema/)).toBeInTheDocument()
    expect(screen.getByText(/Deeply moving from start to finish/)).toBeInTheDocument()
  })

  it('shows agree badge when both users rated the same', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('🤝 You agreed')).toBeInTheDocument()
  })

  it('shows disagree badge when users rated differently', () => {
    const mixedRatings: Rating[] = [
      { ...ratings[0], rating: 'up' },
      { ...ratings[1], rating: 'down' },
    ]
    render(
      <MovieReviewModal
        movie={movie} ratings={mixedRatings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('⚔️ You disagreed')).toBeInTheDocument()
  })

  it('shows No review yet placeholder for a user with no rating', () => {
    const oneRating: Rating[] = [ratings[0]]
    render(
      <MovieReviewModal
        movie={movie} ratings={oneRating} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('No review yet')).toBeInTheDocument()
    expect(screen.getByText(/A masterpiece of world cinema/)).toBeInTheDocument()
  })

  it('shows No reviews yet when no ratings at all', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={[]} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('No reviews yet')).toBeInTheDocument()
  })

  it('calls onEditUser with user1 when Alice edit link is clicked', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    fireEvent.click(screen.getByText("Edit Alice's review"))
    expect(onEditUser).toHaveBeenCalledWith('user1')
  })

  it('calls onEditUser with user2 when Bob edit link is clicked', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    fireEvent.click(screen.getByText("Edit Bob's review"))
    expect(onEditUser).toHaveBeenCalledWith('user2')
  })

  it('calls onClose when Close button is clicked', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render content when open is false', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={false} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.queryByText('The Grand Illusion')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (component not yet wired up — but the file exists, so tests should run)**

```bash
cd /home/ian/src/ianchesal/datenight && npm run test:run -- tests/movie-review-modal.test.tsx
```

Expected: Tests pass (the component was already created in Task 1). If any fail, fix the component.

- [ ] **Step 3: Commit**

```bash
git add tests/movie-review-modal.test.tsx
git commit -m "test: add MovieReviewModal tests"
```

---

## Task 3: Wire MovieReviewModal into MovieCard

**Files:**
- Modify: `src/components/movie-card.tsx`

- [ ] **Step 1: Update MovieCard**

Replace the full contents of `src/components/movie-card.tsx` with:

```tsx
// src/components/movie-card.tsx
'use client'
import { useState } from 'react'
import { ThumbRating } from './thumb-rating'
import { MoviePoster } from './movie-poster'
import { EditRatingDialog } from './edit-rating-dialog'
import { MovieReviewModal } from './movie-review-modal'
import type { Movie, Rating, User, RatingValue } from '@/types'

type CleanupState = 'idle' | 'loading' | 'done' | 'error'

interface MovieCardProps {
  movie: Movie
  userNames: Record<User, string>
  seerrUrl?: string | null
}

export function MovieCard({ movie, userNames, seerrUrl }: MovieCardProps) {
  const [cleanupState, setCleanupState] = useState<CleanupState>('idle')
  const [localRatings, setLocalRatings] = useState<Rating[]>(movie.ratings ?? [])
  const [editDialogUser, setEditDialogUser] = useState<User | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)

  const bothRated = localRatings.length === 2
  const agreed =
    bothRated &&
    localRatings.find((r) => r.user === 'user1')?.rating ===
    localRatings.find((r) => r.user === 'user2')?.rating

  const editingRating = editDialogUser
    ? localRatings.find((r) => r.user === editDialogUser)
    : null

  const handleCleanup = async (e: React.MouseEvent) => {
    e.stopPropagation()
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

    if (!hasRated) {
      return (
        <div key={user} className="bg-stone-50 rounded-lg p-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-400">{userNames[user]}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setEditDialogUser(user) }}
            className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
          >
            Add Review
          </button>
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
              onClick={(e) => { e.stopPropagation(); setEditDialogUser(user) }}
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
      {/* Clickable poster + header area */}
      <button
        className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        onClick={() => setReviewModalOpen(true)}
        aria-label={`View reviews for ${movie.title}`}
      >
        <MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="lg" />

        <div className="px-3 pt-3 pb-1">
          <h3 className="font-bold text-stone-900 text-sm leading-tight mb-0.5">
            {movie.title}
            {seerrUrl && (
              <a
                href={`${seerrUrl}/movie/${movie.tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-1 text-amber-500 hover:text-amber-700 transition-colors font-normal text-xs"
                title="View in Seerr"
              >
                ↗
              </a>
            )}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-stone-400 text-xs">{movie.year}</p>
            {bothRated && (
              <span className="text-xs text-stone-400" title={agreed ? 'You agreed' : 'You disagreed'}>
                {agreed ? '🤝' : '⚔️'}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Rating rows (non-clickable area for the modal trigger) */}
      <div className="px-3 pb-3">
        <div className="mt-2">
          {localRatings.length === 0 ? (
            <p className="text-xs text-stone-400 italic text-center py-2">
              Waiting for both ratings…
            </p>
          ) : (
            <div className="space-y-2">
              {(['user1', 'user2'] as User[]).map((user) => renderRatingRow(user))}
            </div>
          )}
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

      {/* Review modal */}
      <MovieReviewModal
        movie={movie}
        ratings={localRatings}
        userNames={userNames}
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onEditUser={(user) => {
          setReviewModalOpen(false)
          setEditDialogUser(user)
        }}
      />

      {/* Edit/add rating dialog — key forces fresh state when switching users */}
      {editDialogUser && (
        <EditRatingDialog
          key={editDialogUser}
          movie={movie}
          user={editDialogUser}
          existingRating={editingRating?.rating as RatingValue | undefined}
          existingQuote={editingRating?.quote}
          open={true}
          onClose={() => setEditDialogUser(null)}
          onSaved={(updatedRatings) => {
            setLocalRatings(updatedRatings)
            setEditDialogUser(null)
          }}
          onDeleted={() => {
            setLocalRatings((prev) => prev.filter((r) => r.user !== editDialogUser))
            setEditDialogUser(null)
          }}
          userNames={userNames}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ian/src/ianchesal/datenight && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/movie-card.tsx
git commit -m "feat: wire MovieReviewModal into MovieCard"
```

---

## Task 4: Test MovieCard modal trigger

**Files:**
- Create: `tests/movie-card-review-modal.test.tsx`

- [ ] **Step 1: Write the tests**

Create `tests/movie-card-review-modal.test.tsx`:

```tsx
// tests/movie-card-review-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MovieCard } from '@/components/movie-card'
import type { Movie, Rating } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

const movie: Movie = {
  id: 1,
  title: 'Seven Samurai',
  year: 1954,
  runtime: 207,
  description: '',
  posterUrl: '/poster.jpg',
  imdbId: 'tt0047478',
  tmdbId: 346,
  sortOrder: 0,
  status: 'watched',
  seerrStatus: 'available',
  createdAt: '2024-01-01',
}

const userNames = { user1: 'Alice', user2: 'Bob' }

const ratings: Rating[] = [
  { id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'An epic masterpiece.', submittedAt: '2024-01-01' },
  { id: 2, movieId: 1, user: 'user2', rating: 'up', quote: 'Completely gripping.', submittedAt: '2024-01-01' },
]

describe('MovieCard — review modal trigger', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens the review modal when the poster/title area is clicked', () => {
    render(<MovieCard movie={{ ...movie, ratings }} userNames={userNames} />)
    // Modal should not be visible initially
    expect(screen.queryByText('An epic masterpiece.')).not.toBeInTheDocument()
    // Click the trigger button
    fireEvent.click(screen.getByRole('button', { name: /view reviews for Seven Samurai/i }))
    // Full quote now visible in the modal (not line-clamped)
    expect(screen.getByText(/An epic masterpiece/)).toBeInTheDocument()
    expect(screen.getByText(/Completely gripping/)).toBeInTheDocument()
  })

  it('does not open the modal when an Edit button is clicked', () => {
    render(<MovieCard movie={{ ...movie, ratings }} userNames={userNames} />)
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    fireEvent.click(editButtons[0])
    // Modal should not have opened — the review modal title would show the movie title in a dialog
    // The edit dialog opens instead (it renders a different dialog)
    expect(screen.queryByText('An epic masterpiece.')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /home/ian/src/ianchesal/datenight && npm run test:run -- tests/movie-card-review-modal.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 3: Run full test suite**

```bash
cd /home/ian/src/ianchesal/datenight && npm run test:run
```

Expected: All tests pass (68+ tests).

- [ ] **Step 4: Commit**

```bash
git add tests/movie-card-review-modal.test.tsx
git commit -m "test: add MovieCard review modal trigger tests"
```

---

## Task 5: Verify in browser

- [ ] **Step 1: Start dev server**

```bash
cd /home/ian/src/ianchesal/datenight && npm run dev
```

- [ ] **Step 2: Navigate to the Watched view**

Open `http://localhost:3000/watched` in a browser.

- [ ] **Step 3: Verify the golden path**

1. Click the poster area of a watched movie card → modal opens with full reviews side by side
2. Verify quotes are not truncated
3. Click "Edit [user]'s review" → modal closes, EditRatingDialog opens for that user
4. Save the edit → localRatings update, modal can be reopened with updated content
5. Click Close or press Escape → modal dismisses cleanly

- [ ] **Step 4: Verify existing buttons still work without opening the modal**

1. Click the "Edit" button in a rating row → EditRatingDialog opens, modal does NOT open
2. Click "Add Review" if a user hasn't rated → EditRatingDialog opens, modal does NOT open
3. If a movie has a Seerr ID, click "Clean up from Plex" → cleanup fires, modal does NOT open
