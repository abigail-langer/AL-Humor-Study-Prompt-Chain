'use client'

import { useMemo, useState } from 'react'

const SUPPORTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic'
]

type DescribeResponse = {
  imageId: string
  cdnUrl: string
  description: string
}

export default function ImageDescriptionTool() {
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<DescribeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => image && !loading, [image, loading])

  const onFileChange = (file: File | null) => {
    setResult(null)
    setError(null)

    if (!file) {
      setImage(null)
      setPreviewUrl(null)
      return
    }

    if (!SUPPORTED_TYPES.includes(file.type)) {
      setError('Unsupported image type. Use JPEG, PNG, WebP, GIF, or HEIC.')
      setImage(null)
      setPreviewUrl(null)
      return
    }

    setImage(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!image) {
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('image', image)

      const response = await fetch('/api/image/describe', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        const upstreamDetail =
          typeof data.upstream === 'string'
            ? data.upstream
            : data.upstream && typeof data.upstream === 'object'
              ? JSON.stringify(data.upstream)
              : null

        const apiBaseDetail =
          typeof data.apiBase === 'string' ? ` API base: ${data.apiBase}.` : ''

        throw new Error(
          `${data.error ?? 'Failed to describe image'}${apiBaseDetail}${upstreamDetail ? ` Upstream: ${upstreamDetail}` : ''}`
        )
      }

      setResult(data as DescribeResponse)
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pt-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Image Description</h2>
        <p className="mt-2 text-sm text-gray-600">
          Upload a test image and generate text description output from your pipeline.
        </p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <input
            type="file"
            accept={SUPPORTED_TYPES.join(',')}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className="block w-full rounded-md border border-gray-300 p-2 text-sm"
          />

          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="h-56 w-full rounded-lg object-cover" />
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Describing...' : 'Generate Description'}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        {result ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Description</p>
            <p className="mt-2 text-sm text-gray-800">{result.description}</p>
            <p className="mt-3 text-xs text-gray-500">Image ID: {result.imageId}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
