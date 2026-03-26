'use client'

import { useMemo, useState } from 'react'
import type { PromptChainRunResult, PromptChainRole, PromptChainStep } from '@/lib/types'

const DEFAULT_STEPS: PromptChainStep[] = [
  {
    id: '1',
    role: 'system',
    label: 'Style Constraints',
    template:
      'You are a humor-generation assistant for research. Keep output concise and safe. Input: {{input}}'
  },
  {
    id: '2',
    role: 'user',
    label: 'Generate 3 Captions',
    template:
      'Based on this image description and tone, generate 3 humorous captions. Context: {{step_1_output}}'
  },
  {
    id: '3',
    role: 'assistant',
    label: 'Score Captions',
    template:
      'Score each caption from 1-10 for novelty, clarity, and alignment. Captions: {{step_2_output}}'
  }
]

export default function PromptChainBuilder() {
  const [input, setInput] = useState('A dog wearing sunglasses on a surfboard at sunset.')
  const [steps, setSteps] = useState<PromptChainStep[]>(DEFAULT_STEPS)
  const [result, setResult] = useState<PromptChainRunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRun = useMemo(() => input.trim().length > 0 && steps.length > 0, [input, steps])

  const updateStep = (id: string, patch: Partial<PromptChainStep>) => {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)))
  }

  const addStep = () => {
    const nextId = String(Date.now())
    setSteps((current) => [
      ...current,
      { id: nextId, role: 'user', label: `Step ${current.length + 1}`, template: '{{input}}' }
    ])
  }

  const removeStep = (id: string) => {
    setSteps((current) => current.filter((step) => step.id !== id))
  }

  const onRun = async () => {
    if (!canRun) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/prompt-chain/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, steps })
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to run prompt chain')
      }

      setResult(data)
    } catch (runError: unknown) {
      setError(runError instanceof Error ? runError.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const roleOptions: PromptChainRole[] = ['system', 'user', 'assistant']

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Prompt Chain Tool</h1>
        <p className="mt-2 text-sm text-gray-600">
          Build, run, and inspect chained prompts for the AL Humor Study workflow.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label htmlFor="input" className="mb-2 block text-sm font-medium text-gray-700">
              Seed Input
            </label>
            <textarea
              id="input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Chain Steps</h2>
              <button
                type="button"
                onClick={addStep}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              >
                Add Step
              </button>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase text-gray-500">Step {index + 1}</div>
                    <button
                      type="button"
                      onClick={() => removeStep(step.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={step.label}
                      onChange={(event) => updateStep(step.id, { label: event.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="Step label"
                    />

                    <select
                      value={step.role}
                      onChange={(event) => updateStep(step.id, { role: event.target.value as PromptChainRole })}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={step.template}
                    onChange={(event) => updateStep(step.id, { template: event.target.value })}
                    className="mt-2 h-24 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Variables available: <code>{'{{input}}'}</code>, <code>{'{{step_1_output}}'}</code>, <code>{'{{step_2_output}}'}</code>, ...
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onRun}
            disabled={!canRun || loading}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Prompt Chain'}
          </button>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-base font-semibold">Run Output</h2>
            {result ? (
              <div className="space-y-3">
                {result.compiledSteps.map((step, index) => (
                  <div key={step.id} className="rounded-md bg-gray-50 p-3">
                    <div className="mb-1 text-xs uppercase text-gray-500">
                      {index + 1}. {step.label} ({step.role})
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-gray-700">{step.prompt}</pre>
                  </div>
                ))}

                <div className="rounded-md border border-gray-200 p-3">
                  <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Final Output</div>
                  <pre className="whitespace-pre-wrap text-xs text-gray-700">{result.finalOutput}</pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Run the chain to see compiled prompts and final output.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
