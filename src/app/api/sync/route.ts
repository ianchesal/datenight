// src/app/api/sync/route.ts
import { NextResponse } from 'next/server'
import { runSync } from '@/lib/sync'

export async function POST() {
  await runSync()
  return NextResponse.json({ ok: true })
}
