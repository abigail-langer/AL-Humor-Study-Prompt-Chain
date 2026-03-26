'use client'

import { useState } from 'react'

type StepState = 'idle' | 'running' | 'done' | 'error'

type ChainStep = {
  id: number
  label: string
  description: string
  input: string | null
  output: string | null
  state: StepState
  error: string | null
}

const STEP2_SYSTEM =
  'You are a sharp, witty comedian. Given a description of an image, write one punchy, funny observation about it. Keep it to 2–3 sentences. No disclaimers, no setup explanation—just the joke.'

const STEP2_USER = (description: string) =>
  `Image description: ${description}\n\nWrite something funny about this.`

const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic']

function StepConnector() {
  return (
    <div className="flex flex-col items-center py-2">
      <div className="h-6 w-px bg-gray-300" />
      <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
          clipRule="evenodd"
        />
      </svg>
      <div className="h-6 w-px bg-gray-300" />
    </div>
  )
}

function StepBadge({ number, state }: { number: number; state: StepState }) {
  const base = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold'
  const colors: Record<StepState, string> = {
    idle: 'bg-gray-100 text-gray-400',
    running: 'bg-blue-100 text-blue-600 animate-pulse',
    done: 'bg-green-100 text-green-600',
    error: 'bg-red-100 text-red-600',
  }
  return <div className={`${base} ${colors[state]}`}>{number}</div>
}

function OutputBox({ label, text, loading }: { label: string; text: string | null; loading: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200" />
        </div>
      ) : text ? (
        <p className="text-sm leading-relaxed text-gray-800">{text}</p>
      ) : (
        <p className="text-sm italic text-gray-400">Waiting to run…</p>
      )}
    </div>
  )
}

export default function HumorChain() {
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [steps, setSteps] = useState<ChainStep[]>([
    {
      id: 1,
      label: 'Image Description',
      description: 'Upload an image and get a plain-text description of what\'s in it.',
      input: null,
      output: null,
      state: 'idle',
      error: null,
    },
    {
      id: 2,
      label: 'Find the Funny',
      description: 'Takes the description from Step 1 and generates a witty observation about it.',
      input: null,
      output: null,
      state: 'idle',
      error: null,
    },
  ])
  const [running, setRunning] = useState(false)

  const setStep = (id: number, patch: Partial<ChainStep>) => {
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }

  const onFileChange = (file: File | null) => {
    if (!file) {
      setImage(null)
      setPreviewUrl(null)
      return
    }
    if (!SUPPORTED_TYPES.includes(file.type)) return
    setImage(file)
    setPreviewUrl(URL.createObjectURL(file))
    // Reset chain when a new image is picked
    setSteps(prev => prev.map(s => ({ ...s, input: null, output: null, state: 'idle', error: null })))
  }

  const runChain = async () => {
    if (!image || running) return
    setRunning(true)

    // ── Step 1: Image → Description ──────────────────────────────────────────
    setStep(1, { state: 'running', output: null, error: null })

    let description: string | null = null
    try {
      const form = new FormData()
      form.append('image', image)
      const res = await fetch('/api/image/describe', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to describe image')
      description = data.description
      setStep(1, { state: 'done', output: description })
    } catch (err) {
      setStep(1, { state: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
      setRunning(false)
      return
    }

    // ── Step 2: Description → Funny ───────────────────────────────────────────
    setStep(2, { state: 'running', input: description, output: null, error: null })

    try {
      const res = await fetch('/api/chain/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: STEP2_SYSTEM,
          userPrompt: STEP2_USER(description!),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate funny observation')
      setStep(2, { state: 'done', output: data.output })
    } catch (err) {
      setStep(2, { state: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
    }

    setRunning(false)
  }

  const canRun = !!image && !running
  const allDone = steps.every(s => s.state === 'done')

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Humor Flavor Chain</h1>
        <p className="mt-2 text-sm text-gray-500">
          Each step feeds its output into the next — from image to laughs.
        </p>
      </div>

      {/* Image upload */}
      <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-white p-5">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Upload an image to run the chain
        </label>
        <input
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
          onClick={runChain}
          disabled={!canRun}
          className="flex items-center gap-2 rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Running chain…
            </>
          ) : allDone ? (
            'Run Again'
          ) : (
            'Run Chain →'
          )}
        </button>
      </div>

      {/* Chain steps */}
      <div>
        {steps.map((step, idx) => (
          <div key={step.id}>
            {/* Step card */}
            <div
              className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                step.state === 'running'
                  ? 'border-blue-300 ring-1 ring-blue-200'
                  : step.state === 'done'
                  ? 'border-green-200'
                  : step.state === 'error'
                  ? 'border-red-200'
                  : 'border-gray-200'
              }`}
            >
              {/* Step header */}
              <div className="mb-4 flex items-center gap-3">
                <StepBadge number={step.id} state={step.state} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                  <p className="text-xs text-gray-400">{step.description}</p>
                </div>
              </div>

              {/* Step 1: show image input context */}
              {step.id === 1 && image && (
                <p className="mb-3 text-xs text-gray-400">
                  Input: <span className="font-medium text-gray-600">{image.name}</span>
                </p>
              )}

              {/* Step 2: show description as input */}
              {step.id === 2 && step.input && (
                <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Input from Step 1</p>
                  <p className="text-xs leading-relaxed text-gray-600 line-clamp-3">{step.input}</p>
                </div>
              )}

              {/* Output */}
              <OutputBox
                label="Output"
                text={step.output}
                loading={step.state === 'running'}
              />

              {/* Error */}
              {step.error && (
                <p className="mt-2 text-xs text-red-600">{step.error}</p>
              )}
            </div>

            {/* Connector between steps */}
            {idx < steps.length - 1 && <StepConnector />}
          </div>
        ))}
      </div>
    </div>
  )
}
