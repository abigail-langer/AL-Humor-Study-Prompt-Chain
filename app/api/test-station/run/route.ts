import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const API_BASE = 'https://api.almostcrackd.ai'

const SUPPORTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
])

async function parseJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function postUpstream(
  path: string,
  payload: Record<string, unknown>,
  token: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await parseJsonOrText(response)
  return { ok: response.ok, status: response.status, data }
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
    }

    const token = session.access_token
    const formData = await request.formData()
    const image = formData.get('image')
    const humorFlavorId = formData.get('humorFlavorId')

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'image file is required' }, { status: 400 })
    }

    if (!humorFlavorId || typeof humorFlavorId !== 'string') {
      return NextResponse.json({ error: 'humorFlavorId is required' }, { status: 400 })
    }

    if (!SUPPORTED_TYPES.has(image.type)) {
      return NextResponse.json(
        { error: 'Unsupported image type. Use JPEG, PNG, WebP, GIF, or HEIC.' },
        { status: 400 }
      )
    }

    // Step 1: Get presigned upload URL
    const presign = await postUpstream(
      '/pipeline/generate-presigned-url',
      { contentType: image.type },
      token
    )

    if (!presign.ok) {
      return NextResponse.json(
        { error: 'Failed to create upload URL', upstream: presign.data },
        { status: presign.status || 502 }
      )
    }

    const presignData = (presign.data ?? {}) as Record<string, unknown>
    const presignedUrl = presignData.presignedUrl
    const cdnUrl = presignData.cdnUrl

    if (typeof presignedUrl !== 'string' || typeof cdnUrl !== 'string') {
      return NextResponse.json(
        { error: 'Presign response missing presignedUrl/cdnUrl', upstream: presign.data },
        { status: 502 }
      )
    }

    // Step 2: Upload image to S3
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

    // Step 3: Register image
    const register = await postUpstream(
      '/pipeline/upload-image-from-url',
      { imageUrl: cdnUrl, isCommonUse: false },
      token
    )

    if (!register.ok) {
      return NextResponse.json(
        { error: 'Failed to register uploaded image', upstream: register.data },
        { status: register.status || 502 }
      )
    }

    const registerData = (register.data ?? {}) as Record<string, unknown>
    const imageId = registerData.imageId

    if (typeof imageId !== 'string') {
      return NextResponse.json(
        { error: 'Register response missing imageId', upstream: register.data },
        { status: 502 }
      )
    }

    // Step 4: Run standard caption pipeline first — this populates images.image_description,
    // which the custom humor flavor steps depend on as their "step1Output".
    const describe = await postUpstream(
      '/pipeline/generate-captions',
      { imageId },
      token
    )

    if (!describe.ok) {
      return NextResponse.json(
        { error: 'Failed to generate image description', upstream: describe.data },
        { status: describe.status || 502 }
      )
    }

    // Step 5: Generate captions using the custom humor flavor
    const captions = await postUpstream(
      '/pipeline/generate-captions',
      { imageId, humorFlavorId },
      token
    )

    if (!captions.ok) {
      return NextResponse.json(
        { error: 'Failed to generate captions', upstream: captions.data },
        { status: captions.status || 502 }
      )
    }

    return NextResponse.json({ imageId, cdnUrl, captions: captions.data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
