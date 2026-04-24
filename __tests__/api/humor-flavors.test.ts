/**
 * Tests for /api/humor-flavors (GET + POST)
 *
 * Branch map:
 *  GET  – unauthenticated → 401
 *  GET  – authenticated → returns list ordered by id desc
 *  GET  – DB error → 500
 *  POST – unauthenticated → 401
 *  POST – missing slug → 400
 *  POST – valid body → 201 with created flavor
 *  POST – DB error → 500
 */

const mockGetSession = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabaseServer', () => ({
  createSupabaseServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
    from: mockFrom,
  })),
}))

import { GET, POST } from '@/app/api/humor-flavors/route'
import { AUTHED_SESSION, NO_SESSION } from './helpers'

function makeQuery(resolvedValue: unknown) {
  const q = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
  }
  // order resolves to resolvedValue for list queries
  q.order = jest.fn().mockResolvedValue(resolvedValue)
  return q
}

describe('GET /api/humor-flavors', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns flavor list when authenticated', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const flavors = [{ id: 2, slug: 'b' }, { id: 1, slug: 'a' }]
    mockFrom.mockReturnValue(makeQuery({ data: flavors, error: null }))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(flavors)
  })

  it('returns 500 on DB error', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    mockFrom.mockReturnValue(makeQuery({ data: null, error: { message: 'db fail' } }))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('db fail')
  })
})

describe('POST /api/humor-flavors', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const req = new Request('http://localhost/api/humor-flavors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when slug is missing', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const req = new Request('http://localhost/api/humor-flavors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'no slug here' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/slug/i)
  })

  it('returns 201 with created flavor on success', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const created = { id: 99, slug: 'new-flavor', description: 'desc' }
    const q = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: created, error: null }),
    }
    mockFrom.mockReturnValue(q)

    const req = new Request('http://localhost/api/humor-flavors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'new-flavor', description: 'desc' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(created)
  })

  it('returns 500 on DB insert error', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const q = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'unique violation' } }),
    }
    mockFrom.mockReturnValue(q)

    const req = new Request('http://localhost/api/humor-flavors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'dupe' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
