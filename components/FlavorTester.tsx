'use client'

import { useCallback, useRef, useState } from 'react'

type Stage = 'idle' | 'uploading' | 'done' | 'error'

type Caption = { id: string; content: string }

const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic']

const PIPELINE_STEPS = ['Uploading', 'Registering', 'Describing', 'Generating']

// Progress 0–3 maps to which step label is currently active
function Stepper({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-2 py-4">
      {PIPELINE_STEPS.map((label, i) => {
        const done = i < progress
        const active = i === progress
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              done
                ? 'bg-violet-600 text-white'
                : active
                ? 'bg-violet-200 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
            }`}>
              {done ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] font-medium ${
              active ? 'text-violet-600 dark:text-violet-400' : done ? 'text-violet-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'
            }`}>{label}</span>
            {i < PIPELINE_STEPS.length - 1 && (
              <div className="absolute hidden" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function FlavorTester({ flavorId }: { flavorId: string }) {
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [captions, setCaptions] = useState<Caption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStage('idle')
    setProgress(0)
    setPreview(null)
    setResultImage(null)
    setCaptions([])
    setError(null)
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const runPipeline = useCallback(async (file: File) => {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Use JPEG, PNG, WebP, GIF, or HEIC.')
      setStage('error')
      return
    }

    setStage('uploading')
    setProgress(0)
    setError(null)
    setCaptions([])
    setResultImage(null)
    setPreview(URL.createObjectURL(file))

    try {
      const form = new FormData()
      form.append('image', file)

      setProgress(1) // uploading → registering visual hint mid-upload
      const res = await fetch(`/api/humor-flavors/${flavorId}/test`, {
        method: 'POST',
        body: form,
      })

      setProgress(3)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Pipeline failed')

      setResultImage(data.cdnUrl)
      setCaptions(data.captions ?? [])
      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStage('error')
    }
  }, [flavorId])

  const handleFile = (file: File | null | undefined) => {
    if (!file) return
    runPipeline(file)
  }

  const isProcessing = stage === 'uploading'

  return (
    <div className="space-y-4">
      {/* Drop zone — shown while idle or after error */}
      {(stage === 'idle' || stage === 'error') && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload image — click or drag and drop"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]) }}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            isDragging
              ? 'border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/20'
              : 'border-violet-200 hover:border-violet-300 hover:bg-violet-50/50 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-800/50'
          }`}
        >
          <svg className="h-10 w-10 text-violet-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-violet-700 dark:text-gray-300">
              Drop an image or <span className="text-violet-600 underline underline-offset-2 dark:text-violet-400">browse</span>
            </p>
            <p className="mt-1 text-xs text-violet-400 dark:text-gray-500">JPEG · PNG · WebP · GIF · HEIC</p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_TYPES.join(',')}
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
        disabled={isProcessing}
      />

      {/* Processing state */}
      {isProcessing && (
        <div className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {preview && (
            <img src={preview} alt="Preview" className="mb-4 h-40 w-full rounded-lg object-cover" />
          )}
          <Stepper progress={progress} />
          <p className="text-center text-xs text-violet-400 dark:text-gray-500">
            Running pipeline — this may take a moment…
          </p>
        </div>
      )}

      {/* Error state */}
      {stage === 'error' && error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {stage === 'done' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {resultImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resultImage} alt="Uploaded" className="h-52 w-full rounded-t-xl object-cover" />
            )}
            <div className="p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-400 dark:text-gray-500">
                {captions.length} caption{captions.length !== 1 ? 's' : ''} generated
              </p>
              {captions.length > 0 ? (
                <ol className="space-y-2">
                  {captions.map((c, i) => (
                    <li key={c.id} className="flex gap-3 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                        {i + 1}
                      </span>
                      <span className="leading-snug text-violet-900 dark:text-gray-100">{c.content}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm italic text-violet-400 dark:text-gray-500">No captions returned.</p>
              )}
            </div>
          </div>

          <button
            onClick={reset}
            className="w-full rounded-lg border border-violet-200 bg-white py-2 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-50 dark:border-gray-600 dark:bg-gray-800 dark:text-violet-400 dark:hover:bg-gray-700"
          >
            ↑ Test another image
          </button>
        </div>
      )}
    </div>
  )
}
