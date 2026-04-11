// tests/api.preview.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/url-parser', () => ({ parseMovieUrl: vi.fn() }))
vi.mock('@/lib/tmdb', () => ({
  findByImdbId: vi.fn(),
  lookupCriterionSlug: vi.fn(),
}))

import { parseMovieUrl } from '@/lib/url-parser'
import * as tmdb from '@/lib/tmdb'
import { POST } from '@/app/api/preview/route'

const movieData = {
  id: 345911, title: 'Seven Samurai', year: 1954, runtime: 207,
  description: 'A poor village...', posterUrl: 'https://img/poster.jpg',
  imdbId: 'tt0047478',
}

describe('POST /api/preview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 422 when body has no url', async () => {
    const req = new Request('http://localhost/api/preview', {
      method: 'POST', body: JSON.stringify({}),
    })
    expect((await POST(req)).status).toBe(422)
  })

  it('returns 422 when URL cannot be parsed', async () => {
    vi.mocked(parseMovieUrl).mockReturnValue(null)
    const req = new Request('http://localhost/api/preview', {
      method: 'POST', body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect((await POST(req)).status).toBe(422)
  })

  it('returns preview data for a valid IMDB URL', async () => {
    vi.mocked(parseMovieUrl).mockReturnValue({ type: 'imdb', imdbId: 'tt0047478' })
    vi.mocked(tmdb.findByImdbId).mockResolvedValue(movieData)
    const req = new Request('http://localhost/api/preview', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.imdb.com/title/tt0047478/' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('Seven Samurai')
    expect(data.imdbUrl).toBe('https://www.imdb.com/title/tt0047478/')
  })

  it('returns preview data for a valid Criterion URL', async () => {
    vi.mocked(parseMovieUrl).mockReturnValue({ type: 'criterion', slug: '28630-seven-samurai' })
    vi.mocked(tmdb.lookupCriterionSlug).mockResolvedValue(movieData)
    const req = new Request('http://localhost/api/preview', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.criterion.com/films/28630-seven-samurai' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.criterionUrl).toBe('https://www.criterion.com/films/28630-seven-samurai')
  })

  it('returns 404 when TMDB lookup fails', async () => {
    vi.mocked(parseMovieUrl).mockReturnValue({ type: 'imdb', imdbId: 'tt9999999' })
    vi.mocked(tmdb.findByImdbId).mockResolvedValue(null)
    const req = new Request('http://localhost/api/preview', {
      method: 'POST', body: JSON.stringify({ url: 'https://www.imdb.com/title/tt9999999/' }),
    })
    expect((await POST(req)).status).toBe(404)
  })
})
