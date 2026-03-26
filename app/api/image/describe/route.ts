import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const API_BASE = 'https://api.almostcrackd.ai'

const SUPPORTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic'
])

type UpstreamResult = {
  ok: boolean
  status: number
  data: unknown
}

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
): Promise<UpstreamResult> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  })

  const data = await parseJsonOrText(response)

  return { ok: response.ok, status: response.status, data }
}

function extractDescription(data: unknown): string | null {
  if (typeof data === 'string' && data.trim().length > 0) return data

  // generate-captions returns an array of caption records;
  // the image description lives at record.image.image_description
  if (Array.isArray(data) && data.length > 0) {
    for (const item of data) {
      const desc = extractDescription(item)
      if (desc) return desc
    }
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>

    // Nested image object from caption records
    if (record.image && typeof record.image === 'object') {
      const img = record.image as Record<string, unknown>
      if (typeof img.image_description === 'string' && img.image_description.trim().length > 0) {
        return img.image_description
      }
    }

    for (const value of [
      record.description,
      record.imageDescription,
      record.image_description,
      record.text,
      record.output
    ]) {
      if (typeof value === 'string' && value.trim().length > 0) return value
    }
  }

  return null
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
    }

    const token = session.access_token

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

    const upload = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': image.type },
      body: Buffer.from(await image.arrayBuffer())
    })

    if (!upload.ok) {
      return NextResponse.json(
        { error: `Image upload failed (${upload.status} ${upload.statusText})` },
        { status: 502 }
      )
    }

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

    const captions = await postUpstream(
      '/pipeline/generate-captions',
      { imageId },
      token
    )

    if (!captions.ok) {
      return NextResponse.json(
        { error: 'Failed to generate image description', upstream: captions.data },
        { status: captions.status || 502 }
      )
    }

    // The pipeline stores the image description in the images table.
    // Fetch it directly from Supabase now that the pipeline has run.
    const { data: imageRecord, error: dbError } = await supabase
      .from('images')
      .select('image_description')
      .eq('id', imageId)
      .single()

    const description = imageRecord?.image_description

    if (!description) {
      return NextResponse.json(
        {
          error: 'Image description not found after pipeline ran.',
          dbError: dbError?.message ?? null
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ imageId, cdnUrl, description })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
