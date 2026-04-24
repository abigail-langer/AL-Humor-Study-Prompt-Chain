/**
 * Tests for /api/humor-flavors/[id]/steps (POST + PUT)
 * and /api/humor-flavors/[id]/steps/[stepId] (PATCH + DELETE)
 *
 * Branch map for POST /steps:
 *  – unauthed → 401
 *  – valid step → 201
 *  – DB error → 500
 *
 * Branch map for PUT /steps (bulk replace):
 *  – unauthed → 401
 *  – non-array body → 400
 *  – empty array → deletes all, returns []
 *  – valid array → deletes + re-inserts
 *  – delete error → 500
 *  – insert error → 500
 *
 * Branch map for PATCH /steps/[stepId]:
 *  – unauthed → 401
 *  – valid update → 200
 *  – DB error → 500
 *
 * Branch map for DELETE /steps/[stepId]:
 *  – unauthed → 401
 *  – success → { success: true }
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

import { POST, PUT } from '@/app/api/humor-flavors/[id]/steps/route'
import { PATCH, DELETE } from '@/app/api/humor-flavors/[id]/steps/[stepId]/route'
import { AUTHED_SESSION, NO_SESSION } from './helpers'

const FLAVOR_PARAMS = { params: { id: '7' } }
const STEP_PARAMS = { params: { id: '7', stepId: '55' } }

const VALID_STEP = {
  order_by: 1,
  llm_system_prompt: 'sys',
  llm_user_prompt: 'user',
  llm_model_id: 1,
  llm_input_type_id: 1,
  llm_output_type_id: 1,
  humor_flavor_step_type_id: 1,
  llm_temperature: 0.7,
}

function makeReq(body: unknown, method = 'POST') {
  return new Request('http://localhost', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── POST /steps ──────────────────────────────────────────────────────────────

describe('POST /api/humor-flavors/[id]/steps', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await POST(makeReq(VALID_STEP), FLAVOR_PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 201 on successful step creation', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const created = { id: 100, ...VALID_STEP }
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: created, error: null }),
    })
    const res = await POST(makeReq(VALID_STEP), FLAVOR_PARAMS)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(100)
  })

  it('returns 500 on DB error', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    })
    const res = await POST(makeReq(VALID_STEP), FLAVOR_PARAMS)
    expect(res.status).toBe(500)
  })
})

// ─── PUT /steps (bulk replace) ────────────────────────────────────────────────

describe('PUT /api/humor-flavors/[id]/steps', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await PUT(makeReq({ steps: [] }, 'PUT'), FLAVOR_PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 400 when steps is not an array', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const res = await PUT(makeReq({ steps: 'not-array' }, 'PUT'), FLAVOR_PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/array/i)
  })

  it('deletes all and returns [] for empty steps array', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    mockFrom.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    })
    const res = await PUT(makeReq({ steps: [] }, 'PUT'), FLAVOR_PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 500 when delete fails', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    mockFrom.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: { message: 'delete fail' } }),
    })
    const res = await PUT(makeReq({ steps: [VALID_STEP] }, 'PUT'), FLAVOR_PARAMS)
    expect(res.status).toBe(500)
  })

  it('returns inserted steps on success', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const insertedSteps = [{ id: 10, ...VALID_STEP }, { id: 11, ...VALID_STEP, order_by: 2 }]

    mockFrom
      // delete call
      .mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      })
      // insert call
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: insertedSteps, error: null }),
      })

    const steps = [VALID_STEP, { ...VALID_STEP, order_by: 2 }]
    const res = await PUT(makeReq({ steps }, 'PUT'), FLAVOR_PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
  })
})

// ─── PATCH /steps/[stepId] ────────────────────────────────────────────────────

describe('PATCH /api/humor-flavors/[id]/steps/[stepId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await PATCH(makeReq(VALID_STEP, 'PATCH'), STEP_PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 200 with updated step', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const updated = { id: 55, ...VALID_STEP, llm_user_prompt: 'updated' }
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: updated, error: null }),
    })
    const res = await PATCH(makeReq({ ...VALID_STEP, llm_user_prompt: 'updated' }, 'PATCH'), STEP_PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.llm_user_prompt).toBe('updated')
  })

  it('returns 500 on DB error', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    })
    const res = await PATCH(makeReq(VALID_STEP, 'PATCH'), STEP_PARAMS)
    expect(res.status).toBe(500)
  })
})

// ─── DELETE /steps/[stepId] ───────────────────────────────────────────────────

describe('DELETE /api/humor-flavors/[id]/steps/[stepId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await DELETE(new Request('http://localhost'), STEP_PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns { success: true } on success', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    // The route calls .delete().eq(id).eq(flavor_id) — two chained eq() calls
    const makeDeleteChain = (result: { error: unknown }) => {
      const chain: Record<string, unknown> = {}
      chain.delete = jest.fn().mockReturnValue(chain)
      chain.eq = jest.fn().mockReturnValue(chain)
      // Make the chain thenable so `await chain` resolves with result
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve(result).then(resolve)
      return chain
    }
    mockFrom.mockReturnValue(makeDeleteChain({ error: null }))
    const res = await DELETE(new Request('http://localhost'), STEP_PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 on DB error', async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION)
    const makeDeleteChain = (result: { error: unknown }) => {
      const chain: Record<string, unknown> = {}
      chain.delete = jest.fn().mockReturnValue(chain)
      chain.eq = jest.fn().mockReturnValue(chain)
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve(result).then(resolve)
      return chain
    }
    mockFrom.mockReturnValue(makeDeleteChain({ error: { message: 'fail' } }))
    const res = await DELETE(new Request('http://localhost'), STEP_PARAMS)
    expect(res.status).toBe(500)
  })
})
