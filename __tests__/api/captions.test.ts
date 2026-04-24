/**
 * Tests for GET /api/humor-flavors/[id]/captions
 *
 * Branch map:
 *  – unauthed → 401
 *  – no cursor (first page) → returns items + nextCursor if hasMore
 *  – with cursor → applies composite filter
 *  – hasMore=true when rows > PAGE_SIZE (20)
 *  – hasMore=false when rows ≤ PAGE_SIZE
 *  – empty result → { items: [], nextCursor: null, hasMore: false }
 *  – DB error → 500
 */

const mockGetSession = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabaseServer', () => ({
  createSupabaseServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
    from: mockFrom,
  })),
}))

import { GET } from '@/app/api/humor-flavors/[id]/captions/route'
import { AUTHED_SESSION, NO_SESSION } from './helpers'

const PARAMS = { params: { id: '5' } }
const PAGE_SIZE = 20

function makeRow(i: number) {
  return {
    id: `id-${i}`,
    content: `caption ${i}`,
    created_datetime_utc: new Date(1000 - i).toISOString(),
    like_count: 0,
    is_featured: false,
    images: null,
  }
}

function buildQuery(rows: unknown[], error: unknown = null) {
  const result = { data: rows, error }
  // The route uses: .select().eq().order().order().limit() and then optionally .or()
  // When no cursor: `await query` (the chain must be thenable)
  // When cursor: `query = query.or(...)` then `await query` (or() returns a promise)
  const q: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    or: jest.fn().mockResolvedValue(result),
    // Make chain itself thenable for the no-cursor case
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
  }
  return q
}

describe('GET /api/humor-flavors/[id]/captions', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await GET(new Request('http://localhost/api/test'), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns empty list with no cursor when no captions', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    mockFrom.mockReturnValue(buildQuery([]))
    const res = await GET(new Request('http://localhost/api/test'), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
    expect(body.hasMore).toBe(false)
    expect(body.nextCursor).toBeNull()
  })

  it('hasMore=false when rows ≤ PAGE_SIZE', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const rows = Array.from({ length: 10 }, (_, i) => makeRow(i))
    mockFrom.mockReturnValue(buildQuery(rows))
    const res = await GET(new Request('http://localhost/api/test'), PARAMS)
    const body = await res.json()
    expect(body.hasMore).toBe(false)
    expect(body.items).toHaveLength(10)
    expect(body.nextCursor).toBeNull()
  })

  it('hasMore=true when rows > PAGE_SIZE, trims to PAGE_SIZE items', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    // PAGE_SIZE + 1 = 21 rows to signal hasMore
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => makeRow(i))
    mockFrom.mockReturnValue(buildQuery(rows))
    const res = await GET(new Request('http://localhost/api/test'), PARAMS)
    const body = await res.json()
    expect(body.hasMore).toBe(true)
    expect(body.items).toHaveLength(PAGE_SIZE)
    expect(body.nextCursor).not.toBeNull()
    expect(body.nextCursor).toHaveProperty('cursor_ts')
    expect(body.nextCursor).toHaveProperty('cursor_id')
  })

  it('nextCursor points to the last item of current page', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => makeRow(i))
    mockFrom.mockReturnValue(buildQuery(rows))
    const res = await GET(new Request('http://localhost/api/test'), PARAMS)
    const body = await res.json()
    const lastItem = body.items[PAGE_SIZE - 1]
    expect(body.nextCursor.cursor_id).toBe(lastItem.id)
    expect(body.nextCursor.cursor_ts).toBe(lastItem.created_datetime_utc)
  })

  it('applies or() filter when cursor params are present', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const rows = Array.from({ length: 5 }, (_, i) => makeRow(i))
    const q = buildQuery(rows)
    mockFrom.mockReturnValue(q)
    const url = 'http://localhost/api/test?cursor_ts=2024-01-01T00:00:00Z&cursor_id=some-uuid'
    const res = await GET(new Request(url), PARAMS)
    expect(res.status).toBe(200)
    // or() should have been called (not limit) since cursor was present
    expect(q.or).toHaveBeenCalledWith(
      expect.stringContaining('created_datetime_utc.lt.')
    )
  })

  it('returns 500 on DB error', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    mockFrom.mockReturnValue(buildQuery([], { message: 'db error' }))
    const res = await GET(new Request('http://localhost/api/test'), PARAMS)
    expect(res.status).toBe(500)
  })
})
