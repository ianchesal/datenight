// src/app/api/movies/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10)
  await prisma.movie.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
