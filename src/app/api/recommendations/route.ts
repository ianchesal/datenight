// src/app/api/recommendations/route.ts
import { NextResponse } from 'next/server'
import { getRecommendations } from '@/lib/recommendations'

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Recommendation feature requires ANTHROPIC_API_KEY to be set.' },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const criterionOnly: boolean = body?.criterionOnly === true

  try {
    const result = await getRecommendations(criterionOnly)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
