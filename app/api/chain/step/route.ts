import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const client = new Anthropic()

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { systemPrompt, userPrompt } = await request.json()

  if (!userPrompt) {
    return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 })
  }

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: 'user', content: userPrompt }]
  })

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? ''

  return NextResponse.json({ output: text })
}
