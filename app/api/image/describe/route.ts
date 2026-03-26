import { NextResponse } from 'next/server'

const API_BASE = process.env.ALMOSTCRACKD_API_BASE_URL ?? 'https://api.almostcrackd.ai'
const API_TOKEN = process.env.ALMOSTCRACKD_API_TOKEN
const DESCRIBE_PATH = process.env.ALMOSTCRACKD_DESCRIBE_PATH

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
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function postUpstream(path: string, payload: Record<string, unknown>): Promise<UpstreamResult> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`
    },
    body: JSON.stringify(payload)
  })

  const data = await parseJsonOrText(response)

  return {
    ok: response.ok,
    status: response.status,
    data
  }
}

function extractDescription(data: unknown): string | null {
  if (typeof data === 'string') {
    return data
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const candidates = [
      record.description,
      record.imageDescription,
      record.image_description,
      record.text,
      record.output
    ]

    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value
      }
    }
  }

  return null
}

export async function POST(request: Request) {
  try {
    if (!API_TOKEN) {
      return NextResponse.json(
        {
          error:
            'Missing ALMOSTCRACKD_API_TOKEN. Configure this env var to enable image description generation.'
        },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const image = formData.get('image')

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'image file is required' }, { status: 400 })
    }

    if (!SUPPORTED_TYPES.has(image.type)) {
      return NextResponse.json(
        {
          error:
            'Unsupported image type. Use JPEG, PNG, WebP, GIF, or HEIC.'
        },
        { status: 400 }
      )
    }

    const presign = await postUpstream('/pipeline/generate-presigned-url', {
      contentType: image.type
    })

    if (!presign.ok) {
      return NextResponse.json(
        {
          error: 'Failed to create upload URL',
          upstream: presign.data
        },
        { status: presign.status || 502 }
      )
    }

    const presignData = (presign.data ?? {}) as Record<string, unknown>
    const presignedUrl = presignData.presignedUrl
    const cdnUrl = presignData.cdnUrl

    if (typeof presignedUrl !== 'string' || typeof cdnUrl !== 'string') {
      return NextResponse.json(
        {
          error: 'Presign response missing presignedUrl/cdnUrl',
          upstream: presign.data
        },
        { status: 502 }
      )
    }

    const upload = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': image.type
      },
      body: Buffer.from(await image.arrayBuffer())
    })

    if (!upload.ok) {
      return NextResponse.json(
        { error: `Image upload failed (${upload.status} ${upload.statusText})` },
        { status: 502 }
      )
    }

    const register = await postUpstream('/pipeline/upload-image-from-url', {
      imageUrl: cdnUrl,
      isCommonUse: false
    })

    if (!register.ok) {
      return NextResponse.json(
        {
          error: 'Failed to register uploaded image',
          upstream: register.data
        },
        { status: register.status || 502 }
      )
    }

    const registerData = (register.data ?? {}) as Record<string, unknown>
    const imageId = registerData.imageId

    if (typeof imageId !== 'string') {
      return NextResponse.json(
        {
          error: 'Register response missing imageId',
          upstream: register.data
        },
        { status: 502 }
      )
    }

    const describePaths = DESCRIBE_PATH
      ? [DESCRIBE_PATH]
      : [
          '/pipeline/generate-image-description',
          '/pipeline/describe-image',
          '/pipeline/generate-description'
        ]

    const tried: Array<{ path: string; status: number }> = []

    for (const path of describePaths) {
      for (const payload of [{ imageId }, { image_id: imageId }]) {
        const describe = await postUpstream(path, payload)
        tried.push({ path, status: describe.status })

        if (!describe.ok) {
          continue
        }

        const description = extractDescription(describe.data)

        if (description) {
          return NextResponse.json({
            imageId,
            cdnUrl,
            description
          })
        }
      }
    }

    return NextResponse.json(
      {
        error:
          'Could not extract image description from upstream response. Set ALMOSTCRACKD_DESCRIBE_PATH to your exact endpoint.',
        tried
      },
      { status: 502 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
