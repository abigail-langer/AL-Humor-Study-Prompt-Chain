import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

type StepInput = {
  order_by: number
  llm_system_prompt: string
  llm_user_prompt: string
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const steps: StepInput[] = body.steps

  if (!Array.isArray(steps)) {
    return NextResponse.json({ error: 'steps array is required' }, { status: 400 })
  }

  // Delete existing steps and re-insert
  const { error: deleteError } = await supabase
    .from('humor_flavor_steps')
    .delete()
    .eq('humor_flavor_id', params.id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (steps.length === 0) {
    return NextResponse.json([])
  }

  const rows = steps.map((s) => ({
    humor_flavor_id: params.id,
    order_by: s.order_by,
    llm_system_prompt: s.llm_system_prompt,
    llm_user_prompt: s.llm_user_prompt,
  }))

  const { data, error } = await supabase
    .from('humor_flavor_steps')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
