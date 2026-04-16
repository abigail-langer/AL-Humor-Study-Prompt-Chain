import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { slug } = body

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  const { data: source, error: sourceError } = await supabase
    .from('humor_flavors')
    .select('*')
    .eq('id', params.id)
    .single()

  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 404 })

  const { data: newFlavor, error: flavorError } = await supabase
    .from('humor_flavors')
    .insert({ slug, description: source.description })
    .select()
    .single()

  if (flavorError) return NextResponse.json({ error: flavorError.message }, { status: 500 })

  const { data: sourceSteps, error: stepsError } = await supabase
    .from('humor_flavor_steps')
    .select('*')
    .eq('humor_flavor_id', params.id)
    .order('order_by', { ascending: true })

  if (stepsError) return NextResponse.json({ error: stepsError.message }, { status: 500 })

  if (sourceSteps && sourceSteps.length > 0) {
    const newSteps = sourceSteps.map(({ id: _id, humor_flavor_id: _fid, ...rest }) => ({
      ...rest,
      humor_flavor_id: newFlavor.id,
    }))

    const { error: insertError } = await supabase
      .from('humor_flavor_steps')
      .insert(newSteps)

    if (insertError) {
      await supabase.from('humor_flavors').delete().eq('id', newFlavor.id)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json(newFlavor, { status: 201 })
}
