// src/lib/url-parser.ts

export type ParsedUrl =
  | { type: 'imdb'; imdbId: string }
  | { type: 'criterion'; slug: string }

export function parseMovieUrl(url: string): ParsedUrl | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.hostname === 'www.imdb.com' || parsed.hostname === 'imdb.com') {
    const match = parsed.pathname.match(/\/title\/(tt\d+)/i)
    if (match) return { type: 'imdb', imdbId: match[1] }
  }

  if (
    parsed.hostname === 'www.criterion.com' ||
    parsed.hostname === 'criterion.com'
  ) {
    const match = parsed.pathname.match(/^\/films\/([^/]+)\/?$/)
    if (match) return { type: 'criterion', slug: match[1] }
  }

  return null
}
