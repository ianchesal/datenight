// src/app/api/plex-sync/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncDateNightCollection, getMachineIdentifier, findMovieLibrarySectionId, findMovieRatingKey } from '@/lib/plex'

export async function POST() {
  const watchlist = await prisma.movie.findMany({
    where: { status: 'watchlist' },
    orderBy: { sortOrder: 'asc' },
  })

  await syncDateNightCollection(watchlist.map((m) => ({ title: m.title, year: m.year })))

  return NextResponse.json({ ok: true, count: watchlist.length })
}

export async function GET() {
  const steps: Record<string, unknown> = {}

  try {
    steps.machineId = await getMachineIdentifier()
  } catch (e) {
    steps.machineId = { error: String(e) }
  }

  const sectionId = await findMovieLibrarySectionId()
  steps.sectionId = sectionId

  if (sectionId) {
    const watchlist = await prisma.movie.findMany({
      where: { status: 'watchlist' },
      orderBy: { sortOrder: 'asc' },
      take: 5,
    })

    steps.ratingKeyLookups = await Promise.all(
      watchlist.map(async (m) => ({
        title: m.title,
        year: m.year,
        ratingKey: await findMovieRatingKey(sectionId, m.title, m.year),
      }))
    )
  }

  return NextResponse.json(steps)
}
