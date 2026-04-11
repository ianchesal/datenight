// src/app/api/movies/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const movies = await prisma.movie.findMany({
    where: { status: 'watchlist' },
    orderBy: { sortOrder: 'asc' },
    include: { ratings: true },
  })
  return NextResponse.json(movies)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { _max } = await prisma.movie.aggregate({ _max: { sortOrder: true } })
  const nextOrder = (_max.sortOrder ?? 0) + 1

  const movie = await prisma.movie.create({
    data: {
      title: body.title,
      year: body.year,
      runtime: body.runtime,
      description: body.description,
      posterUrl: body.posterUrl,
      imdbId: body.imdbId,
      tmdbId: body.tmdbId,
      imdbUrl: body.imdbUrl ?? null,
      criterionUrl: body.criterionUrl ?? null,
      sortOrder: nextOrder,
    },
  })
  return NextResponse.json(movie, { status: 201 })
}
