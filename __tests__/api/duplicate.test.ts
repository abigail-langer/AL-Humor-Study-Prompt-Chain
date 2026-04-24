/**
 * Tests for POST /api/humor-flavors/[id]/duplicate
 *
 * Branch map:
 *  – unauthed → 401
 *  – missing slug → 400
 *  – source flavor not found → 404
 *  – flavor create error → 500
 *  – steps fetch error → 500
 *  – flavor with steps → 201, steps copied
 *  – flavor with NO steps → 201 (no step insertion)
 *  – step insert error → 500, rolls back new flavor
 */

const mockGetSession = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabaseServer', () => ({
  createSupabaseServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
    from: mockFrom,
  })),
}))

import { POST } from '@/app/api/humor-flavors/[id]/duplicate/route'
import { AUTHED_SESSION, NO_SESSION } from './helpers'

const PARAMS = { params: { id: '10' } }

function makeReq(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/humor-flavors/[id]/duplicate', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await POST(makeReq({ slug: 'copy' }), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 400 when slug is missing', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const res = await POST(makeReq({}), PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/slug/i)
  })

  it('returns 404 when source flavor not found', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    })
    const res = await POST(makeReq({ slug: 'copy' }), PARAMS)
    expect(res.status).toBe(404)
  })

  it('returns 201 and duplicates flavor without steps', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const sourceFlavor = { id: 10, slug: 'original', description: 'desc' }
    const newFlavor = { id: 99, slug: 'copy', description: 'desc' }

    mockFrom
      // 1. fetch source
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: sourceFlavor, error: null }),
      })
      // 2. insert new flavor
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: newFlavor, error: null }),
      })
      // 3. fetch source steps → empty
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      })

    const res = await POST(makeReq({ slug: 'copy' }), PARAMS)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.slug).toBe('copy')
  })

  it('returns 201 and copies all steps when source has steps', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const sourceFlavor = { id: 10, slug: 'original', description: 'desc' }
    const newFlavor = { id: 99, slug: 'copy', description: 'desc' }
    const sourceSteps = [
      { id: 1, humor_flavor_id: 10, order_by: 1, llm_model_id: 1 },
      { id: 2, humor_flavor_id: 10, order_by: 2, llm_model_id: 2 },
    ]

    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: sourceFlavor, error: null }),
      })
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: newFlavor, error: null }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: sourceSteps, error: null }),
      })
      // 4. insert copied steps
      .mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      })

    const res = await POST(makeReq({ slug: 'copy' }), PARAMS)
    expect(res.status).toBe(201)
  })

  it('rolls back new flavor when step insert fails', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const sourceFlavor = { id: 10, slug: 'original', description: 'desc' }
    const newFlavor = { id: 99, slug: 'copy', description: 'desc' }
    const sourceSteps = [{ id: 1, humor_flavor_id: 10, order_by: 1 }]

    const rollbackMock = jest.fn().mockReturnThis()
    const rollbackEq = jest.fn().mockResolvedValue({ error: null })

    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: sourceFlavor, error: null }),
      })
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: newFlavor, error: null }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: sourceSteps, error: null }),
      })
      // step insert fails
      .mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: { message: 'insert failed' } }),
      })
      // rollback delete
      .mockReturnValueOnce({
        delete: rollbackMock,
        eq: rollbackEq,
      })

    const res = await POST(makeReq({ slug: 'copy' }), PARAMS)
    expect(res.status).toBe(500)
  })
})
