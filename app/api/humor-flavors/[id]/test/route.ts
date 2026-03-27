import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const API_BASE = 'https://api.almostcrackd.ai'

const SUPPORTED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
])

async function postUpstream(path: string, payload: Record<string, unknown>, token: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = text }
  return { ok: res.ok, status: res.status, data }
}

// POST /api/humor-flavors/[id]/test
// Body: multipart/form-data with field "image"
// Runs the full 4-step pipeline:
//   1. Presign  2. Upload to S3  3. Register  4. Generate captions (×2)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = session.access_token
  const humorFlavorId = params.id

  const formData = await request.formData()
  const image = formData.get('image')
  if (!(image instanceof File)) {
    return NextResponse.json({ error: 'image file is required' }, { status: 400 })
  }
  if (!SUPPORTED_TYPES.has(image.type)) {
    return NextResponse.json(
      { error: 'Unsupported image type. Use JPEG, PNG, WebP, GIF, or HEIC.' },
      { status: 400 }
    )
  }

  // ── Step 1: Presign ──────────────────────────────────────────────────────
  const presign = await postUpstream(
    '/pipeline/generate-presigned-url',
    { contentType: image.type },
    token
  )
  if (!presign.ok) {
    return NextResponse.json(
      { error: 'Failed to get upload URL', upstream: presign.data },
      { status: presign.status || 502 }
    )
  }
  const { presignedUrl, cdnUrl } = presign.data as Record<string, string>
  if (!presignedUrl || !cdnUrl) {
    return NextResponse.json(
      { error: 'Presign response missing presignedUrl/cdnUrl', upstream: presign.data },
      { status: 502 }
    )
  }

  // ── Step 2: Upload to S3 ─────────────────────────────────────────────────
  const upload = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': image.type },
    body: Buffer.from(await image.arrayBuffer()),
  })
  if (!upload.ok) {
    return NextResponse.json(
      { error: `Image upload failed (${upload.status} ${upload.statusText})` },
      { status: 502 }
    )
  }

  // ── Step 3: Register ─────────────────────────────────────────────────────
  const register = await postUpstream(
    '/pipeline/upload-image-from-url',
    { imageUrl: cdnUrl, isCommonUse: false },
    token
  )
  if (!register.ok) {
    return NextResponse.json(
      { error: 'Failed to register image', upstream: register.data },
      { status: register.status || 502 }
    )
  }
  const { imageId } = register.data as Record<string, string>
  if (!imageId) {
    return NextResponse.json(
      { error: 'Register response missing imageId', upstream: register.data },
      { status: 502 }
    )
  }

  // ── Step 4a: Generate captions (no flavor) — populates image_description ─
  const captionsBase = await postUpstream(
    '/pipeline/generate-captions',
    { imageId },
    token
  )
  if (!captionsBase.ok) {
    return NextResponse.json(
      { error: 'Failed to generate image description', upstream: captionsBase.data },
      { status: captionsBase.status || 502 }
    )
  }

  // ── Step 4b: Generate captions with the specific humor flavor ────────────
  const captionsFlavor = await postUpstream(
    '/pipeline/generate-captions',
    { imageId, humorFlavorId },
    token
  )
  if (!captionsFlavor.ok) {
    return NextResponse.json(
      { error: 'Failed to generate flavor captions', upstream: captionsFlavor.data },
      { status: captionsFlavor.status || 502 }
    )
  }

  const raw = Array.isArray(captionsFlavor.data) ? captionsFlavor.data : []
  const captions = raw.map((c: Record<string, unknown>) => ({
    id: c.id,
    content: typeof c.content === 'string' ? c.content : JSON.stringify(c),
  }))

  return NextResponse.json({ cdnUrl, imageId, captions })
}
