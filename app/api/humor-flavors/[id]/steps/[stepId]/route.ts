import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stepId: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('humor_flavor_steps')
    .update({
      ...(body.order_by !== undefined && { order_by: body.order_by }),
      llm_system_prompt: body.llm_system_prompt,
      llm_user_prompt: body.llm_user_prompt,
      llm_model_id: body.llm_model_id,
      llm_input_type_id: body.llm_input_type_id,
      llm_output_type_id: body.llm_output_type_id,
      humor_flavor_step_type_id: body.humor_flavor_step_type_id,
      llm_temperature: body.llm_temperature,
    })
    .eq('id', params.stepId)
    .eq('humor_flavor_id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; stepId: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('humor_flavor_steps')
    .delete()
    .eq('id', params.stepId)
    .eq('humor_flavor_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
