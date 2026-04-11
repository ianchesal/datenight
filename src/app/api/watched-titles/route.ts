// src/app/api/watched-titles/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const movies = await prisma.movie.findMany({
    where: { status: 'watched' },
    orderBy: { watchedAt: 'desc' },
    take: 10,
    select: { title: true, year: true },
  })
  return NextResponse.json(movies)
}
