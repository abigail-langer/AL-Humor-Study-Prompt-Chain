import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const PAGE_SIZE = 20

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)

  // Cursor-based pagination: cursor is an ISO timestamp of the last seen row's
  // created_datetime_utc. We use (created_datetime_utc DESC, id DESC) so the
  // result set is stable even when two rows share the same timestamp.
  const cursorTs = searchParams.get('cursor_ts')   // ISO string
  const cursorId = searchParams.get('cursor_id')   // uuid string

  const flavorId = params.id

  let query = supabase
    .from('captions')
    .select(`
      id,
      content,
      created_datetime_utc,
      like_count,
      is_featured,
      images (
        id,
        url,
        image_description,
        additional_context
      )
    `)
    .eq('humor_flavor_id', flavorId)
    .order('created_datetime_utc', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1) // fetch one extra to know whether there is a next page

  // Apply cursor if provided — skip rows that are older than (or equal timestamp
  // but UUID-sort earlier than) the last seen row.
  if (cursorTs && cursorId) {
    // Supabase JS v2 doesn't support composite OR-based cursor natively, so we
    // fall back to a raw PostgREST filter using the `or` helper:
    // (created_datetime_utc < cursorTs) OR
    // (created_datetime_utc = cursorTs AND id < cursorId)
    query = query.or(
      `created_datetime_utc.lt.${cursorTs},and(created_datetime_utc.eq.${cursorTs},id.lt.${cursorId})`
    )
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const hasMore = rows.length > PAGE_SIZE
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  const lastItem = items[items.length - 1]
  const nextCursor =
    hasMore && lastItem
      ? {
          cursor_ts: lastItem.created_datetime_utc,
          cursor_id: lastItem.id,
        }
      : null

  return NextResponse.json({ items, nextCursor, hasMore })
}
