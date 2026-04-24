/**
 * Middleware tests: covers all auth/routing branches in middleware.ts
 *
 * Branch map:
 *  1. Public path  → pass through with x-pathname header
 *  2. Private path, no user  → redirect to /login?next=<path>
 *  3. Private path, user but no admin role  → redirect to /login?error=unauthorized
 *  4. Private path, user with is_superadmin  → pass through
 *  5. Private path, user with is_matrix_admin only  → pass through
 */

import { NextRequest } from 'next/server'

// ─── Supabase SSR mock ─────────────────────────────────────────────────────────

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNextRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`)
}

const SUPERADMIN_PROFILE = { data: { is_superadmin: true, is_matrix_admin: false }, error: null }
const MATRIX_ADMIN_PROFILE = { data: { is_superadmin: false, is_matrix_admin: true }, error: null }
const NON_ADMIN_PROFILE = { data: { is_superadmin: false, is_matrix_admin: false }, error: null }

function mockSupabaseUser(user: object | null, profile: typeof SUPERADMIN_PROFILE) {
  mockGetUser.mockResolvedValue({ data: { user } })
  if (user) {
    const singleMock = jest.fn().mockResolvedValue(profile)
    const eqMock = jest.fn().mockReturnValue({ single: singleMock })
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock })
    mockFrom.mockReturnValue({ select: selectMock })
  }
}

// ─── Import after mocks ────────────────────────────────────────────────────────

let middleware: typeof import('@/middleware').middleware

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  const mod = await import('@/middleware')
  middleware = mod.middleware
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('middleware – public paths', () => {
  const publicPaths = [
    '/login',
    '/auth/callback',
    '/auth/callback/extra',
    '/_next/static/file.js',
    '/favicon.ico',
  ]

  test.each(publicPaths)('passes through public path: %s', async (pathname) => {
    const req = makeNextRequest(pathname)
    const res = await middleware(req)
    // Should NOT be a redirect
    expect(res.status).not.toBe(307)
    expect(res.status).not.toBe(302)
    expect(res.headers.get('x-pathname')).toBe(pathname)
  })
})

describe('middleware – unauthenticated private paths', () => {
  it('redirects to /login with next param when no user session', async () => {
    mockSupabaseUser(null, NON_ADMIN_PROFILE)
    const req = makeNextRequest('/some-private-page')
    const res = await middleware(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('/login')
    expect(location).toContain('next=')
  })
})

describe('middleware – authenticated but non-admin', () => {
  it('redirects to /login?error=unauthorized for non-admin user', async () => {
    mockSupabaseUser({ id: 'user-1' }, NON_ADMIN_PROFILE)
    const req = makeNextRequest('/dashboard')
    const res = await middleware(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('/login')
    expect(location).toContain('error=unauthorized')
  })
})

describe('middleware – admin users', () => {
  it('passes through for superadmin', async () => {
    mockSupabaseUser({ id: 'admin-1' }, SUPERADMIN_PROFILE)
    const req = makeNextRequest('/dashboard')
    const res = await middleware(req)
    // Not a redirect
    expect(res.status).toBeLessThan(300)
    expect(res.headers.get('x-pathname')).toBe('/dashboard')
  })

  it('passes through for matrix_admin', async () => {
    mockSupabaseUser({ id: 'admin-2' }, MATRIX_ADMIN_PROFILE)
    const req = makeNextRequest('/settings')
    const res = await middleware(req)
    expect(res.status).toBeLessThan(300)
    expect(res.headers.get('x-pathname')).toBe('/settings')
  })
})
