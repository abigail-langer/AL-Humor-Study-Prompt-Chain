'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

type HumorFlavor = {
  id: string
  slug: string
  description: string | null
}

type FlavorStep = {
  id: string
  order_by: number
  llm_system_prompt: string
  llm_user_prompt: string
  llm_model_id: number
  llm_input_type_id: number
  llm_output_type_id: number
  humor_flavor_step_type_id: number
  llm_temperature: number | null
}

type StepDraft = Omit<FlavorStep, 'id'>

type LookupItem = {
  id: number
  name?: string
  description?: string
  slug?: string
  is_temperature_supported?: boolean
}

type StepOptions = {
  inputTypes: LookupItem[]
  outputTypes: LookupItem[]
  stepTypes: LookupItem[]
  models: LookupItem[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MODEL_ID = 1
const DEFAULT_OUTPUT_TYPE_ID = 1
const DEFAULT_STEP_TYPE_ID = 3
const DEFAULT_INPUT_TYPE_ID = 1

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function labelFor(item: LookupItem) {
  return item.name ?? item.description ?? item.slug ?? String(item.id)
}

function emptyDraft(): StepDraft {
  return {
    order_by: 0,
    llm_system_prompt: '',
    llm_user_prompt: '',
    llm_model_id: DEFAULT_MODEL_ID,
    llm_input_type_id: DEFAULT_INPUT_TYPE_ID,
    llm_output_type_id: DEFAULT_OUTPUT_TYPE_ID,
    humor_flavor_step_type_id: DEFAULT_STEP_TYPE_ID,
    llm_temperature: null,
  }
}

// ── Step form ─────────────────────────────────────────────────────────────────

function StepForm({
  draft, onChange, onSave, onCancel, saving, error, stepOptions, saveLabel,
}: {
  draft: StepDraft
  onChange: (patch: Partial<StepDraft>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
  stepOptions: StepOptions
  saveLabel: string
}) {
  const supportsTemp =
    (stepOptions.models.find(m => m.id === draft.llm_model_id) as LookupItem | undefined)
      ?.is_temperature_supported ?? true

  return (
    <div className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-violet-400">Model</label>
          <select value={draft.llm_model_id} onChange={e => onChange({ llm_model_id: Number(e.target.value) })}
            className="w-full rounded-md border border-violet-200 px-2 py-1.5 text-xs text-violet-900 focus:border-violet-400 focus:outline-none">
            {stepOptions.models.map(m => <option key={m.id} value={m.id}>{labelFor(m)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-violet-400">Input Type</label>
          <select value={draft.llm_input_type_id} onChange={e => onChange({ llm_input_type_id: Number(e.target.value) })}
            className="w-full rounded-md border border-violet-200 px-2 py-1.5 text-xs text-violet-900 focus:border-violet-400 focus:outline-none">
            {stepOptions.inputTypes.map(t => <option key={t.id} value={t.id}>{labelFor(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-violet-400">Output Type</label>
          <select value={draft.llm_output_type_id} onChange={e => onChange({ llm_output_type_id: Number(e.target.value) })}
            className="w-full rounded-md border border-violet-200 px-2 py-1.5 text-xs text-violet-900 focus:border-violet-400 focus:outline-none">
            {stepOptions.outputTypes.map(t => <option key={t.id} value={t.id}>{labelFor(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-violet-400">Step Type</label>
          <select value={draft.humor_flavor_step_type_id} onChange={e => onChange({ humor_flavor_step_type_id: Number(e.target.value) })}
            className="w-full rounded-md border border-violet-200 px-2 py-1.5 text-xs text-violet-900 focus:border-violet-400 focus:outline-none">
            {stepOptions.stepTypes.map(t => <option key={t.id} value={t.id}>{labelFor(t)}</option>)}
          </select>
        </div>
      </div>

      {supportsTemp && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-violet-400">
            Temperature <span className="text-violet-300">(0–2, leave blank for default)</span>
          </label>
          <input type="number" min={0} max={2} step={0.1}
            value={draft.llm_temperature ?? ''}
            onChange={e => onChange({ llm_temperature: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="e.g. 1.0"
            className="w-32 rounded-md border border-violet-200 px-3 py-1.5 text-sm text-violet-900 focus:border-violet-400 focus:outline-none"
          />
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-violet-400">System Prompt</label>
          <textarea value={draft.llm_system_prompt}
            onChange={e => onChange({ llm_system_prompt: e.target.value })}
            placeholder="You are a…"
            rows={3}
            className="w-full rounded-md border border-violet-200 px-3 py-2 text-sm text-violet-900 placeholder:text-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-violet-400">User Prompt</label>
          <textarea value={draft.llm_user_prompt}
            onChange={e => onChange({ llm_user_prompt: e.target.value })}
            placeholder="Generate…"
            rows={3}
            className="w-full rounded-md border border-violet-200 px-3 py-2 text-sm text-violet-900 placeholder:text-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={onSave} disabled={saving}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : saveLabel}
        </button>
        <button onClick={onCancel} className="text-sm text-violet-400 hover:text-violet-700 transition-colors">
          Cancel
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type View = 'list' | 'edit'

export default function FlavorBuilder() {
  const [view, setView] = useState<View>('list')
  const [flavors, setFlavors] = useState<HumorFlavor[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stepOptions, setStepOptions] = useState<StepOptions>({
    inputTypes: [], outputTypes: [], stepTypes: [], models: [],
  })

  const [flavor, setFlavor] = useState<HumorFlavor | null>(null)
  const [steps, setSteps] = useState<FlavorStep[]>([])

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [savingFlavor, setSavingFlavor] = useState(false)
  const [flavorError, setFlavorError] = useState<string | null>(null)
  const [deletingFlavor, setDeletingFlavor] = useState(false)

  const [editingStepId, setEditingStepId] = useState<string | 'new' | null>(null)
  const [stepDraft, setStepDraft] = useState<StepDraft>(emptyDraft())
  const [savingStep, setSavingStep] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null)
  const [reorderingStepId, setReorderingStepId] = useState<string | null>(null)

  const loadFlavors = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const res = await fetch('/api/humor-flavors')
      const data = await res.json()
      if (res.ok) setFlavors(data)
      else setListError(data.error ?? 'Failed to load flavors')
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load flavors')
    } finally {
      setLoadingList(false)
    }
  }, [])

  const loadSteps = useCallback(async (flavorId: string) => {
    const res = await fetch(`/api/humor-flavors/${flavorId}`)
    if (!res.ok) return
    const data = await res.json()
    setSteps((data.steps ?? []).sort((a: FlavorStep, b: FlavorStep) => a.order_by - b.order_by))
  }, [])

  useEffect(() => {
    loadFlavors()
    fetch('/api/step-options')
      .then(r => r.json())
      .then((data: StepOptions) => setStepOptions(data))
      .catch(() => {})
  }, [loadFlavors])

  const openCreate = () => {
    setFlavor(null)
    setSteps([])
    setName('')
    setSlug('')
    setDescription('')
    setFlavorError(null)
    setEditingStepId(null)
    setView('edit')
  }

  const openFlavor = async (f: HumorFlavor) => {
    setFlavor(f)
    setName('')
    setSlug(f.slug)
    setDescription(f.description ?? '')
    setFlavorError(null)
    setEditingStepId(null)
    await loadSteps(f.id)
    setView('edit')
  }

  const backToList = () => {
    setView('list')
    setEditingStepId(null)
  }

  const handleSaveFlavor = async () => {
    setSavingFlavor(true)
    setFlavorError(null)
    try {
      if (!flavor) {
        const res = await fetch('/api/humor-flavors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: slugify(name), description }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to create flavor')
        setFlavor(data)
        setSlug(data.slug)
        await loadFlavors()
      } else {
        const savedSlug = name ? slugify(name) : flavor.slug
        const res = await fetch(`/api/humor-flavors/${flavor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: savedSlug, description }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to update flavor')
        setFlavor(data)
        setSlug(data.slug)
        setName('')
        await loadFlavors()
      }
    } catch (err) {
      setFlavorError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSavingFlavor(false)
    }
  }

  const handleDeleteFlavor = async () => {
    if (!flavor) return
    if (!confirm(`Delete "${flavor.slug}"? This cannot be undone.`)) return
    setDeletingFlavor(true)
    try {
      const res = await fetch(`/api/humor-flavors/${flavor.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setFlavorError(data.error ?? 'Failed to delete')
        return
      }
      await loadFlavors()
      backToList()
    } finally {
      setDeletingFlavor(false)
    }
  }

  const openNewStep = () => {
    setStepDraft(emptyDraft())
    setStepError(null)
    setEditingStepId('new')
  }

  const openEditStep = (step: FlavorStep) => {
    setStepDraft({
      order_by: step.order_by,
      llm_system_prompt: step.llm_system_prompt,
      llm_user_prompt: step.llm_user_prompt,
      llm_model_id: step.llm_model_id,
      llm_input_type_id: step.llm_input_type_id,
      llm_output_type_id: step.llm_output_type_id,
      humor_flavor_step_type_id: step.humor_flavor_step_type_id,
      llm_temperature: step.llm_temperature,
    })
    setStepError(null)
    setEditingStepId(step.id)
  }

  const handleSaveStep = async () => {
    if (!flavor) return
    setSavingStep(true)
    setStepError(null)
    try {
      if (editingStepId === 'new') {
        const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.order_by)) + 1 : 1
        const res = await fetch(`/api/humor-flavors/${flavor.id}/steps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...stepDraft, order_by: nextOrder }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to add step')
      } else {
        const res = await fetch(`/api/humor-flavors/${flavor.id}/steps/${editingStepId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stepDraft),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to update step')
      }
      await loadSteps(flavor.id)
      setEditingStepId(null)
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSavingStep(false)
    }
  }

  const handleReorderStep = async (stepId: string, direction: 'up' | 'down') => {
    if (!flavor) return
    const idx = steps.findIndex(s => s.id === stepId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= steps.length) return

    const stepA = steps[idx]
    const stepB = steps[swapIdx]
    setReorderingStepId(stepId)
    try {
      await Promise.all([
        fetch(`/api/humor-flavors/${flavor.id}/steps/${stepA.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_by: stepB.order_by }),
        }),
        fetch(`/api/humor-flavors/${flavor.id}/steps/${stepB.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_by: stepA.order_by }),
        }),
      ])
      await loadSteps(flavor.id)
    } finally {
      setReorderingStepId(null)
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!flavor) return
    if (!confirm('Delete this step?')) return
    setDeletingStepId(stepId)
    try {
      const res = await fetch(`/api/humor-flavors/${flavor.id}/steps/${stepId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setFlavorError(data.error ?? 'Failed to delete step')
        return
      }
      await loadSteps(flavor.id)
    } finally {
      setDeletingStepId(null)
    }
  }

  const filtered = flavors.filter(f => {
    const q = search.toLowerCase()
    return f.slug.toLowerCase().includes(q) || (f.description ?? '').toLowerCase().includes(q)
  })

  const displaySlug = name ? slugify(name) : slug
  const isCreating = !flavor
  const canSaveFlavor = isCreating ? !!name : true

  // ── List view ──────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-violet-50">
        <div className="flex-shrink-0 border-b border-violet-100 bg-violet-50 px-6 py-6">
          <div className="mx-auto w-3/4">
            <div className="mb-5 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-violet-900">Humor Flavors</h1>
              <button onClick={openCreate}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                + New Flavor
              </button>
            </div>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or description…"
              className="w-full rounded-lg border border-violet-200 bg-white px-4 py-2.5 text-sm text-violet-900 shadow-sm placeholder:text-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto w-3/4">
            {loadingList ? (
              <div className="py-16 text-center text-sm text-violet-400">Loading…</div>
            ) : listError ? (
              <div className="py-16 text-center text-sm text-red-500">{listError}</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-violet-400">
                {search ? 'No flavors match your search.' : 'No flavors yet. Create one!'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {filtered.map(f => (
                  <button key={f.id} onClick={() => openFlavor(f)}
                    className="rounded-xl border border-violet-100 bg-white p-4 text-left shadow-sm transition-all hover:border-violet-300 hover:shadow-md">
                    <div className="mb-1 font-semibold text-violet-900">{f.slug}</div>
                    {f.description && <div className="line-clamp-2 text-xs text-violet-500">{f.description}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Edit view ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-violet-50">
      <div className="flex-shrink-0 border-b border-violet-100 bg-violet-50 px-6 py-4">
        <div className="mx-auto w-3/4 flex items-center justify-between">
          <button onClick={backToList}
            className="flex items-center gap-1 text-sm font-medium text-violet-500 hover:text-violet-800 transition-colors">
            ← Back
          </button>
          {!isCreating && (
            <button onClick={handleDeleteFlavor} disabled={deletingFlavor}
              className="text-sm text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors">
              {deletingFlavor ? 'Deleting…' : 'Delete flavor'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto w-3/4 space-y-6 pb-10">

          {/* Flavor details */}
          <div className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-violet-900">
              {isCreating ? 'New Humor Flavor' : 'Flavor Details'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-violet-500">
                  Name {!isCreating && <span className="text-violet-300">(enter to rename)</span>}
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder={isCreating ? 'e.g. Dry Wit' : flavor?.slug}
                  className="w-full rounded-md border border-violet-200 px-3 py-2 text-sm text-violet-900 placeholder:text-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-violet-500">Slug (auto-generated)</label>
                <div className="rounded-md border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-400">
                  {displaySlug || <span className="italic text-violet-200">will appear here</span>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-violet-500">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the humor style…" rows={2}
                  className="w-full rounded-md border border-violet-200 px-3 py-2 text-sm text-violet-900 placeholder:text-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={handleSaveFlavor} disabled={savingFlavor || !canSaveFlavor}
                className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors">
                {savingFlavor ? 'Saving…' : isCreating ? 'Create Flavor' : 'Save Changes'}
              </button>
              {flavorError && <span className="text-sm text-red-500">{flavorError}</span>}
            </div>
          </div>

          {/* Steps — only shown once flavor exists */}
          {!isCreating && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-violet-700">
                  Prompt Steps{steps.length > 0 ? ` (${steps.length})` : ''}
                </h3>
                {editingStepId !== 'new' && (
                  <button onClick={openNewStep}
                    className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors">
                    + Add Step
                  </button>
                )}
              </div>

              {steps.length === 0 && editingStepId !== 'new' && (
                <div className="rounded-xl border border-dashed border-violet-200 p-8 text-center">
                  <p className="text-sm text-violet-400">No steps yet.</p>
                  <button onClick={openNewStep}
                    className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                    Add First Step
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {steps.map((step, idx) => {
                  if (editingStepId === step.id) {
                    return (
                      <motion.div key={step.id} layout transition={{ type: 'spring', stiffness: 400, damping: 35 }}>
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white">
                            {idx + 1}
                          </div>
                          <span className="text-sm font-semibold text-violet-800">Step {idx + 1}</span>
                        </div>
                        <StepForm draft={stepDraft}
                          onChange={patch => setStepDraft(prev => ({ ...prev, ...patch }))}
                          onSave={handleSaveStep} onCancel={() => setEditingStepId(null)}
                          saving={savingStep} error={stepError}
                          stepOptions={stepOptions} saveLabel="Save Step" />
                      </motion.div>
                    )
                  }
                  const isReordering = reorderingStepId === step.id
                  return (
                    <motion.div key={step.id} layout transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      className="flex items-start justify-between rounded-xl border border-violet-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => handleReorderStep(step.id, 'up')}
                            disabled={idx === 0 || isReordering || !!editingStepId}
                            className="flex h-5 w-5 items-center justify-center rounded text-violet-300 hover:text-violet-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move up"
                          >
                            ▲
                          </button>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white">
                            {idx + 1}
                          </div>
                          <button
                            onClick={() => handleReorderStep(step.id, 'down')}
                            disabled={idx === steps.length - 1 || isReordering || !!editingStepId}
                            className="flex h-5 w-5 items-center justify-center rounded text-violet-300 hover:text-violet-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-violet-900">Step {idx + 1}</span>
                          {step.llm_system_prompt && (
                            <p className="mt-1 line-clamp-1 text-xs text-violet-500">{step.llm_system_prompt}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 pl-4">
                        <button onClick={() => openEditStep(step)} disabled={isReordering}
                          className="text-xs text-violet-400 hover:text-violet-700 disabled:opacity-40 transition-colors">Edit</button>
                        <button onClick={() => handleDeleteStep(step.id)} disabled={deletingStepId === step.id || isReordering}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors">
                          {deletingStepId === step.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}

                {editingStepId === 'new' && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white">
                        {steps.length + 1}
                      </div>
                      <span className="text-sm font-semibold text-violet-800">Step {steps.length + 1}</span>
                    </div>
                    <StepForm draft={stepDraft}
                      onChange={patch => setStepDraft(prev => ({ ...prev, ...patch }))}
                      onSave={handleSaveStep} onCancel={() => setEditingStepId(null)}
                      saving={savingStep} error={stepError}
                      stepOptions={stepOptions} saveLabel="Add Step" />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
