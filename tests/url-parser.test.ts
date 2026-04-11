// tests/url-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseMovieUrl } from '@/lib/url-parser'

describe('parseMovieUrl', () => {
  it('parses a standard IMDB URL', () => {
    expect(parseMovieUrl('https://www.imdb.com/title/tt1430132/')).toEqual({
      type: 'imdb',
      imdbId: 'tt1430132',
    })
  })

  it('parses an IMDB URL without trailing slash', () => {
    expect(parseMovieUrl('https://www.imdb.com/title/tt0047478')).toEqual({
      type: 'imdb',
      imdbId: 'tt0047478',
    })
  })

  it('parses an IMDB URL with extra path segments', () => {
    expect(
      parseMovieUrl('https://www.imdb.com/title/tt1430132/reviews/?ref_=tt_ql_3')
    ).toEqual({ type: 'imdb', imdbId: 'tt1430132' })
  })

  it('parses a short imdb.com URL', () => {
    expect(parseMovieUrl('https://imdb.com/title/tt0047478/')).toEqual({
      type: 'imdb',
      imdbId: 'tt0047478',
    })
  })

  it('parses a Criterion films URL', () => {
    expect(
      parseMovieUrl('https://www.criterion.com/films/29136-akira')
    ).toEqual({ type: 'criterion', slug: '29136-akira' })
  })

  it('parses a Criterion URL with trailing slash', () => {
    expect(
      parseMovieUrl('https://www.criterion.com/films/29136-akira/')
    ).toEqual({ type: 'criterion', slug: '29136-akira' })
  })

  it('returns null for an unrecognized domain', () => {
    expect(parseMovieUrl('https://letterboxd.com/film/seven-samurai')).toBeNull()
  })

  it('returns null for a non-film Criterion URL', () => {
    expect(parseMovieUrl('https://www.criterion.com/shop')).toBeNull()
  })

  it('returns null for garbage input', () => {
    expect(parseMovieUrl('not a url at all')).toBeNull()
  })
})
