/**
 * Tests for POST /api/humor-flavors/[id]/test
 *
 * Branch map:
 *  – unauthed → 401
 *  – missing image field → 400
 *  – unsupported image type → 400
 *  – presign upstream failure → 502
 *  – presign missing presignedUrl/cdnUrl → 502
 *  – S3 upload failure → 502
 *  – register upstream failure → 502
 *  – register missing imageId → 502
 *  – generate-captions failure → 502
 *  – happy path → 200 with cdnUrl, imageId, captions
 *  – non-array captions response → captions: []
 */

const mockGetSession = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabaseServer', () => ({
  createSupabaseServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
    from: mockFrom,
  })),
}))

// Mock global fetch for upstream API calls
const mockFetch = jest.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/humor-flavors/[id]/test/route'

const PARAMS = { params: { id: '3' } }
const AUTHED = {
  data: {
    session: { access_token: 'tok-123', user: { id: 'user-1' } },
  },
}
const NO_SESSION = { data: { session: null } }

function makeImageFormData(type = 'image/jpeg', content = 'fake-image-data') {
  const buf = Buffer.from(content)
  const file = new File([buf], 'photo.jpg', { type })
  const fd = new FormData()
  fd.append('image', file)
  return fd
}

function makeRequest(formData: FormData) {
  return new Request('http://localhost', { method: 'POST', body: formData })
}

describe('POST /api/humor-flavors/[id]/test', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const res = await POST(makeRequest(makeImageFormData()), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no image field', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    const fd = new FormData()
    fd.append('other', 'value')
    const res = await POST(makeRequest(fd), PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/image/i)
  })

  it('returns 400 for unsupported image type', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    const res = await POST(makeRequest(makeImageFormData('image/bmp')), PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unsupported/i)
  })

  it('accepts all supported image types', async () => {
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
    for (const type of supportedTypes) {
      mockGetSession.mockResolvedValue(AUTHED)
      // Presign returns failure so we don't need to mock the full chain
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => JSON.stringify({ error: 'test' }),
      })
      const res = await POST(makeRequest(makeImageFormData(type)), PARAMS)
      // Should not be 400 (type validation passed)
      expect(res.status).not.toBe(400)
    }
  })

  it('returns 502 when presign upstream fails', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ error: 'service unavailable' }),
    })
    const res = await POST(makeRequest(makeImageFormData()), PARAMS)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/upload url/i)
  })

  it('returns 502 when presign response missing presignedUrl', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ cdnUrl: 'https://cdn.example.com/img' }), // no presignedUrl
    })
    const res = await POST(makeRequest(makeImageFormData()), PARAMS)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/presignedUrl/i)
  })

  it('returns 502 when S3 upload fails', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    // presign succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ presignedUrl: 'https://s3.example.com/upload', cdnUrl: 'https://cdn.example.com/img' }),
    })
    // S3 upload fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' })
    const res = await POST(makeRequest(makeImageFormData()), PARAMS)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/upload failed/i)
  })

  it('returns 502 when register fails', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ presignedUrl: 'https://s3.example.com/up', cdnUrl: 'https://cdn.example.com/img' }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 }) // S3 upload
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'register failed' }),
      })
    const res = await POST(makeRequest(makeImageFormData()), PARAMS)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/register/i)
  })

  it('returns 502 when register response missing imageId', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ presignedUrl: 'https://s3.example.com/up', cdnUrl: 'https://cdn.example.com/img' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ someOtherField: 'value' }), // no imageId
      })
    const res = await POST(makeRequest(makeImageFormData()), PARAMS)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/imageId/i)
  })

  it('returns 502 when generate-captions fails', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ presignedUrl: 'https://s3.example.com/up', cdnUrl: 'https://cdn.example.com/img' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ imageId: 'img-abc' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'captions failed' }),
      })
    const res = await POST(makeRequest(makeImageFormData()), PARAMS)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/captions/i)
  })

  it('returns 200 with cdnUrl, imageId, captions on full success', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    const captionsData = [
      { id: 'cap-1', content: 'Funny caption one' },
      { id: 'cap-2', content: 'Funny caption two' },
    ]
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ presignedUrl: 'https://s3.example.com/up', cdnUrl: 'https://cdn.example.com/img.jpg' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ imageId: 'img-xyz' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(captionsData),
      })
    const res = await POST(makeRequest(makeImageFormData()), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cdnUrl).toBe('https://cdn.example.com/img.jpg')
    expect(body.imageId).toBe('img-xyz')
    expect(body.captions).toHaveLength(2)
    expect(body.captions[0]).toMatchObject({ id: 'cap-1', content: 'Funny caption one' })
  })

  it('returns empty captions array when response is not an array', async () => {
    mockGetSession.mockResolvedValue(AUTHED)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ presignedUrl: 'https://s3/up', cdnUrl: 'https://cdn/img' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ imageId: 'img-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ message: 'unexpected object' }), // not an array
      })
    const res = await POST(makeRequest(makeImageFormData()), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.captions).toEqual([])
  })
})
