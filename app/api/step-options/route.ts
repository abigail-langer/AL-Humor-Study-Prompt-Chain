import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [inputTypes, outputTypes, stepTypes, models] = await Promise.all([
    supabase.from('llm_input_types').select('*').order('id'),
    supabase.from('llm_output_types').select('*').order('id'),
    supabase.from('humor_flavor_step_types').select('*').order('id'),
    supabase.from('llm_models').select('*').order('id'),
  ])

  return NextResponse.json({
    inputTypes: inputTypes.data ?? [],
    outputTypes: outputTypes.data ?? [],
    stepTypes: stepTypes.data ?? [],
    models: models.data ?? [],
    errors: {
      inputTypes: inputTypes.error?.message,
      outputTypes: outputTypes.error?.message,
      stepTypes: stepTypes.error?.message,
      models: models.error?.message,
    },
  })
}
