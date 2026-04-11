// src/app/api/preview/route.ts
import { NextResponse } from 'next/server'
import { parseMovieUrl } from '@/lib/url-parser'
import { findByImdbId, lookupCriterionSlug } from '@/lib/tmdb'
import type { MoviePreview } from '@/types'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const url: string | undefined = body?.url
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 422 })

  const parsed = parseMovieUrl(url)
  if (!parsed) return NextResponse.json({ error: 'unrecognized URL' }, { status: 422 })

  let movie = null
  if (parsed.type === 'imdb') {
    movie = await findByImdbId(parsed.imdbId)
  } else {
    movie = await lookupCriterionSlug(parsed.slug)
  }

  if (!movie) return NextResponse.json({ error: 'movie not found' }, { status: 404 })

  const preview: MoviePreview = {
    ...movie,
    ...(parsed.type === 'imdb' ? { imdbUrl: url } : { criterionUrl: url }),
  }
  return NextResponse.json(preview)
}
