/**
 * Tests for /api/humor-flavors/[id] (GET, PUT, DELETE)
 *
 * Branch map:
 *  GET    – unauthed → 401
 *  GET    – flavor not found → 404
 *  GET    – found → returns flavor + steps
 *  GET    – steps DB error → 500
 *  PUT    – unauthed → 401
 *  PUT    – success → returns updated flavor
 *  PUT    – DB error → 500
 *  DELETE – unauthed → 401
 *  DELETE – success → { success: true }
 *  DELETE – DB error → 500
 */

const mockGetSession = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabaseServer', () => ({
  createSupabaseServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
    from: mockFrom,
  })),
}))

import { GET, PUT, DELETE } from '@/app/api/humor-flavors/[id]/route'
import { AUTHED_SESSION, NO_SESSION } from './helpers'

const PARAMS = { params: { id: '42' } }

function buildFlavorQuery(flavor: unknown, steps: unknown) {
  // We need two different from() calls: one for flavor, one for steps
  let callCount = 0
  mockFrom.mockImplementation(() => {
    callCount++
    if (callCount === 1) {
      // humor_flavors query
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(flavor),
      }
    }
    // humor_flavor_steps query
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue(steps),
    }
  })
}

describe('GET /api/humor-flavors/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await GET(new Request('http://localhost'), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 404 when flavor not found (PGRST116)', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    buildFlavorQuery(
      { data: null, error: { code: 'PGRST116', message: 'no rows found' } },
      { data: [], error: null }
    )
    const res = await GET(new Request('http://localhost'), PARAMS)
    expect(res.status).toBe(404)
  })

  it('returns 500 for non-PGRST116 flavor DB errors', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    buildFlavorQuery(
      { data: null, error: { code: '42P01', message: 'relation does not exist' } },
      { data: [], error: null }
    )
    const res = await GET(new Request('http://localhost'), PARAMS)
    expect(res.status).toBe(500)
  })

  it('returns flavor with steps on success', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const flavor = { id: 42, slug: 'funny', description: 'desc' }
    const steps = [{ id: 1, order_by: 1 }, { id: 2, order_by: 2 }]
    buildFlavorQuery({ data: flavor, error: null }, { data: steps, error: null })
    const res = await GET(new Request('http://localhost'), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slug).toBe('funny')
    expect(body.steps).toHaveLength(2)
  })

  it('returns 500 when steps query errors', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    buildFlavorQuery(
      { data: { id: 42 }, error: null },
      { data: null, error: { message: 'steps error' } }
    )
    const res = await GET(new Request('http://localhost'), PARAMS)
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/humor-flavors/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'x' }),
    })
    const res = await PUT(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns updated flavor on success', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const updated = { id: 42, slug: 'updated', description: 'new' }
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: updated, error: null }),
    })
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'updated', description: 'new' }),
    })
    const res = await PUT(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slug).toBe('updated')
  })

  it('returns 500 on DB error', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    })
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'x' }),
    })
    const res = await PUT(req, PARAMS)
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/humor-flavors/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await DELETE(new Request('http://localhost'), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns { success: true } on successful deletion', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    // Two from() calls: delete steps, then delete flavor
    mockFrom.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    })
    const res = await DELETE(new Request('http://localhost'), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when flavor deletion errors', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // steps delete succeeds
        return { delete: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) }
      }
      // flavor delete fails
      return { delete: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: { message: 'fail' } }) }
    })
    const res = await DELETE(new Request('http://localhost'), PARAMS)
    expect(res.status).toBe(500)
  })
})
