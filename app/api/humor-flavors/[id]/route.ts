import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: flavor, error: flavorError } = await supabase
    .from('humor_flavors')
    .select('*')
    .eq('id', params.id)
    .single()

  if (flavorError) {
    // PGRST116 = no rows returned by .single(); treat as 404. All other errors are 500.
    const status = flavorError.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: flavorError.message }, { status })
  }

  const { data: steps, error: stepsError } = await supabase
    .from('humor_flavor_steps')
    .select('*')
    .eq('humor_flavor_id', params.id)
    .order('order_by', { ascending: true })

  if (stepsError) return NextResponse.json({ error: stepsError.message }, { status: 500 })

  return NextResponse.json({ ...flavor, steps: steps ?? [] })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { slug, description } = body

  const { data, error } = await supabase
    .from('humor_flavors')
    .update({ slug, description })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Steps will cascade delete if FK is set up, otherwise delete manually
  await supabase.from('humor_flavor_steps').delete().eq('humor_flavor_id', params.id)

  const { error } = await supabase.from('humor_flavors').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
