import { NextResponse } from 'next/server'
import { runPromptChain } from '@/lib/promptChain'
import type { PromptChainRunRequest } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PromptChainRunRequest

    if (!body.input || !Array.isArray(body.steps)) {
      return NextResponse.json(
        { error: 'Invalid payload: expected input and steps.' },
        { status: 400 }
      )
    }

    const result = runPromptChain(body)

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
