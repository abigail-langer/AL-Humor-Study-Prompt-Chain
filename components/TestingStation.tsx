'use client'

import { useEffect, useRef, useState } from 'react'

type HumorFlavor = {
  id: string
  slug: string
}

type CaptionRecord = {
  id?: string
  content?: string
  caption?: string
  text?: string
  [key: string]: unknown
}

const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic']

function extractCaptionText(record: CaptionRecord): string {
  return String(record.content ?? record.caption ?? record.text ?? JSON.stringify(record))
}

export default function TestingStation() {
  const [flavors, setFlavors] = useState<HumorFlavor[]>([])
  const [loadingFlavors, setLoadingFlavors] = useState(true)
  const [selectedFlavorId, setSelectedFlavorId] = useState<string>('')
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [captions, setCaptions] = useState<unknown>(null)
  const [cdnUrl, setCdnUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadFlavors() {
      try {
        const res = await fetch('/api/humor-flavors')
        if (res.ok) {
          const data: HumorFlavor[] = await res.json()
          setFlavors(data)
          if (data.length > 0) setSelectedFlavorId(data[0].id)
        }
      } finally {
        setLoadingFlavors(false)
      }
    }
    loadFlavors()
  }, [])

  const onFileChange = (file: File | null) => {
    if (!file) {
      setImage(null)
      setPreviewUrl(null)
      return
    }
    if (!SUPPORTED_TYPES.includes(file.type)) return
    setImage(file)
    setPreviewUrl(URL.createObjectURL(file))
    setCaptions(null)
    setCdnUrl(null)
    setError(null)
  }

  const run = async () => {
    if (!image || !selectedFlavorId || running) return
    setRunning(true)
    setError(null)
    setCaptions(null)
    setCdnUrl(null)

    try {
      const form = new FormData()
      form.append('image', image)
      form.append('humorFlavorId', selectedFlavorId)

      const res = await fetch('/api/test-station/run', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        const detail = data.upstream ? ` — upstream: ${JSON.stringify(data.upstream)}` : ''
        throw new Error((data.error ?? 'Failed to run test') + detail)
      }

      setCaptions(data.captions)
      setCdnUrl(data.cdnUrl ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  const canRun = !!image && !!selectedFlavorId && !running

  const renderCaptions = () => {
    if (!captions) return null

    // Array of caption records
    if (Array.isArray(captions)) {
      if (captions.length === 0) {
        return <p className="text-sm text-gray-500 italic">No captions returned.</p>
      }
      return (
        <ol className="space-y-3">
          {captions.map((item, idx) => (
            <li key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <span className="mr-2 text-xs font-bold text-gray-400">{idx + 1}.</span>
              <span className="text-sm text-gray-800">
                {typeof item === 'string' ? item : extractCaptionText(item as CaptionRecord)}
              </span>
            </li>
          ))}
        </ol>
      )
    }

    // Single string or object
    return (
      <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
        {typeof captions === 'string' ? captions : JSON.stringify(captions, null, 2)}
      </pre>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900">Testing Station</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload an image and run it through a humor flavor to see the generated captions.
        </p>
      </div>

      {/* Flavor selector */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">Humor Flavor</label>
        {loadingFlavors ? (
          <div className="h-9 w-full animate-pulse rounded-md bg-gray-100" />
        ) : flavors.length === 0 ? (
          <p className="text-sm text-amber-600">
            No flavors found. Create one in the Flavor Builder tab first.
          </p>
        ) : (
          <select
            value={selectedFlavorId}
            onChange={e => setSelectedFlavorId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          >
            {flavors.map(f => (
              <option key={f.id} value={f.id}>
                {f.slug}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Image upload */}
      <div className="mb-5 rounded-xl border border-dashed border-gray-300 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">Upload Image</label>
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_TYPES.join(',')}
          onChange={e => onFileChange(e.target.files?.[0] ?? null)}
          className="block w-full rounded-md border border-gray-300 p-2 text-sm"
        />
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            className="mt-4 h-48 w-full rounded-lg object-cover"
          />
        )}
      </div>

      {/* Run button */}
      <div className="mb-8 flex justify-center">
        <button
          onClick={run}
          disabled={!canRun}
          className="flex items-center gap-2 rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Running…
            </>
          ) : (
            'Run Test →'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {captions !== null && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Generated Captions</h3>
            {cdnUrl && (
              <a
                href={cdnUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
              >
                View uploaded image ↗
              </a>
            )}
          </div>
          {renderCaptions()}
        </div>
      )}
    </div>
  )
}
