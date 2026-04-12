// tests/plex.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { findMovieRatingKey, getMachineIdentifier, syncDateNightCollection } =
  await import('@/lib/plex')

describe('getMachineIdentifier', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env.PLEX_URL = 'http://plex:32400'
    process.env.PLEX_TOKEN = 'test-token'
  })

  it('returns the machine identifier', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { machineIdentifier: 'abc123' },
      }),
    })
    expect(await getMachineIdentifier()).toBe('abc123')
  })
})

describe('findMovieRatingKey', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env.PLEX_URL = 'http://plex:32400'
    process.env.PLEX_TOKEN = 'test-token'
  })

  it('returns ratingKey when movie found by title+year', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Metadata: [{ ratingKey: '42', title: 'Seven Samurai', year: 1954 }] },
      }),
    })
    expect(await findMovieRatingKey('1', 'Seven Samurai', 1954)).toBe('42')
  })

  it('returns null when no result matches the year', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Metadata: [{ ratingKey: '42', title: 'Seven Samurai', year: 1999 }] },
      }),
    })
    expect(await findMovieRatingKey('1', 'Seven Samurai', 1954)).toBeNull()
  })

  it('returns null when no results returned', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ MediaContainer: { Metadata: [] } }),
    })
    expect(await findMovieRatingKey('1', 'Unknown Film', 2000)).toBeNull()
  })

  it('returns null on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await findMovieRatingKey('1', 'Seven Samurai', 1954)).toBeNull()
  })
})

describe('syncDateNightCollection', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env.PLEX_URL = 'http://plex:32400'
    process.env.PLEX_TOKEN = 'test-token'
  })

  it('does nothing when no movies are provided', async () => {
    await syncDateNightCollection([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('creates a collection when none exists', async () => {
    // getMachineIdentifier + findMovieLibrarySectionId (parallel)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ MediaContainer: { machineIdentifier: 'abc123' } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Directory: [{ type: 'movie', key: '1', title: 'Movies' }] },
      }),
    })
    // findMovieRatingKey — section search returns match
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Metadata: [{ ratingKey: '42', title: 'Seven Samurai', year: 1954 }] },
      }),
    })
    // findCollection → not found
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ MediaContainer: { Metadata: [] } }),
    })
    // createCollection
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Metadata: [{ ratingKey: 'col1' }] },
      }),
    })

    await syncDateNightCollection([{ title: 'Seven Samurai', year: 1954 }])

    const calls = mockFetch.mock.calls.map((c) => c[0] as string)
    expect(calls.some((url) => url.includes('/library/collections?'))).toBe(true)
  })

  it('deletes and recreates the collection when one already exists', async () => {
    // getMachineIdentifier + findMovieLibrarySectionId (parallel)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ MediaContainer: { machineIdentifier: 'abc123' } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Directory: [{ type: 'movie', key: '1', title: 'Movies' }] },
      }),
    })
    // findMovieRatingKey — section search returns match
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Metadata: [{ ratingKey: '42', title: 'Seven Samurai', year: 1954 }] },
      }),
    })
    // findCollection → found
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Metadata: [{ title: 'Date Night', ratingKey: 'col1' }] },
      }),
    })
    // deleteCollection
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    // createCollection
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Metadata: [{ ratingKey: 'col2' }] },
      }),
    })

    await syncDateNightCollection([{ title: 'Seven Samurai', year: 1954 }])

    const calls = mockFetch.mock.calls
    const deleteCalls = calls.filter(
      (c) => (c[1] as RequestInit)?.method === 'DELETE'
    )
    expect(deleteCalls.length).toBe(1)
    expect(deleteCalls[0][0] as string).toContain('/library/collections/col1')
  })
})
