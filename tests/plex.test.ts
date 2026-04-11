// tests/plex.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { findMovieRatingKey, getMachineIdentifier, syncDateNightPlaylist } =
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

  it('returns ratingKey when movie found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Metadata: [{ ratingKey: '42' }] },
      }),
    })
    expect(await findMovieRatingKey('tt0047478')).toBe('42')
  })

  it('returns null when movie not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ MediaContainer: { Metadata: [] } }),
    })
    expect(await findMovieRatingKey('tt9999999')).toBeNull()
  })

  it('returns null on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await findMovieRatingKey('tt0047478')).toBeNull()
  })
})

describe('syncDateNightPlaylist', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env.PLEX_URL = 'http://plex:32400'
    process.env.PLEX_TOKEN = 'test-token'
  })

  it('does nothing when no movies are available', async () => {
    await syncDateNightPlaylist([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('creates a playlist when none exists', async () => {
    // getMachineIdentifier
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ MediaContainer: { machineIdentifier: 'abc123' } }),
    })
    // findMovieRatingKey for tt0047478
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ MediaContainer: { Metadata: [{ ratingKey: '42' }] } }),
    })
    // findPlaylist → not found
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ MediaContainer: { Metadata: [] } }),
    })
    // createPlaylist
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        MediaContainer: { Metadata: [{ ratingKey: 'pl1' }] },
      }),
    })

    await syncDateNightPlaylist([{ imdbId: 'tt0047478' }])

    // Verify playlist creation was called
    const calls = mockFetch.mock.calls.map((c) => c[0] as string)
    expect(calls.some((url) => url.includes('/playlists?') && !url.includes('/items'))).toBe(true)
  })
})
