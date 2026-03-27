'use client'

import { useCallback, useEffect, useState } from 'react'

type HumorFlavor = {
  id: string
  slug: string
  description: string | null
}

type FlavorStep = {
  id?: string
  order_by: number
  llm_system_prompt: string
  llm_user_prompt: string
  llm_model_id: number
  llm_input_type_id: number
  llm_output_type_id: number
  humor_flavor_step_type_id: number
  llm_temperature: number | null
}

type FlavorWithSteps = HumorFlavor & { steps: FlavorStep[] }

type LookupItem = { id: number; name?: string; description?: string; slug?: string; is_temperature_supported?: boolean }

type StepOptions = {
  inputTypes: LookupItem[]
  outputTypes: LookupItem[]
  stepTypes: LookupItem[]
  models: LookupItem[]
}

const DEFAULT_MODEL_ID = 1
const DEFAULT_OUTPUT_TYPE_ID = 1
const STEP1_STEP_TYPE_ID = 2
const DEFAULT_STEP_TYPE_ID = 3
const INPUT_IMAGE_AND_TEXT = 1
const INPUT_TEXT_ONLY = 2

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function defaultStep(orderBy: number): FlavorStep {
  return {
    order_by: orderBy,
    llm_system_prompt: '',
    llm_user_prompt: '',
    llm_model_id: DEFAULT_MODEL_ID,
    llm_input_type_id: orderBy === 1 ? INPUT_IMAGE_AND_TEXT : INPUT_TEXT_ONLY,
    llm_output_type_id: DEFAULT_OUTPUT_TYPE_ID,
    humor_flavor_step_type_id: orderBy === 1 ? STEP1_STEP_TYPE_ID : DEFAULT_STEP_TYPE_ID,
    llm_temperature: null,
  }
}

const EMPTY_STEPS: FlavorStep[] = [defaultStep(1), defaultStep(2), defaultStep(3)]

function labelFor(item: LookupItem) {
  return item.name ?? item.description ?? item.slug ?? String(item.id)
}

type View = 'list' | 'edit'

export default function FlavorBuilder() {
  const [view, setView] = useState<View>('list')
  const [flavors, setFlavors] = useState<HumorFlavor[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<FlavorWithSteps | null>(null)
  const [creating, setCreating] = useState(false)
  const [stepOptions, setStepOptions] = useState<StepOptions>({
    inputTypes: [], outputTypes: [], stepTypes: [], models: [],
  })

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<FlavorStep[]>(EMPTY_STEPS)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadFlavors = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const res = await fetch('/api/humor-flavors')
      const data = await res.json()
      if (res.ok) {
        setFlavors(data)
      } else {
        setListError(data.error ?? 'Failed to load flavors')
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load flavors')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadFlavors()
    fetch('/api/step-options')
      .then(r => r.json())
      .then((data: StepOptions) => setStepOptions(data))
      .catch(() => {})
  }, [loadFlavors])

  const openCreate = () => {
    setSelected(null)
    setCreating(true)
    setName('')
    setSlug('')
    setDescription('')
    setSteps(EMPTY_STEPS.map(s => ({ ...s })))
    setSaveError(null)
    setSaveSuccess(false)
    setView('edit')
  }

  const openFlavor = async (id: string) => {
    setSaveError(null)
    setSaveSuccess(false)
    const res = await fetch(`/api/humor-flavors/${id}`)
    if (!res.ok) return
    const data: FlavorWithSteps = await res.json()
    setSelected(data)
    setCreating(false)
    setName('')
    setSlug(data.slug)
    setDescription(data.description ?? '')
    const merged = [1, 2, 3].map(orderBy => {
      const existing = data.steps.find(s => s.order_by === orderBy)
      if (existing) {
        return {
          order_by: orderBy,
          llm_system_prompt: existing.llm_system_prompt ?? '',
          llm_user_prompt: existing.llm_user_prompt ?? '',
          llm_model_id: existing.llm_model_id ?? DEFAULT_MODEL_ID,
          llm_input_type_id: existing.llm_input_type_id ?? (orderBy === 1 ? INPUT_IMAGE_AND_TEXT : INPUT_TEXT_ONLY),
          llm_output_type_id: existing.llm_output_type_id ?? DEFAULT_OUTPUT_TYPE_ID,
          humor_flavor_step_type_id: existing.humor_flavor_step_type_id ?? (orderBy === 1 ? STEP1_STEP_TYPE_ID : DEFAULT_STEP_TYPE_ID),
          llm_temperature: existing.llm_temperature ?? null,
        }
      }
      return defaultStep(orderBy)
    })
    setSteps(merged)
    setView('edit')
  }

  const handleNameChange = (value: string) => {
    setName(value)
    setSlug(slugify(value))
  }

  const updateStep = (index: number, patch: Partial<FlavorStep>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      let flavorId: string
      if (creating) {
        const res = await fetch('/api/humor-flavors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, description }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to create flavor')
        flavorId = data.id
      } else {
        const savedSlug = name ? slug : selected!.slug
        const res = await fetch(`/api/humor-flavors/${selected!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: savedSlug, description }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to update flavor')
        flavorId = selected!.id
      }
      const stepsRes = await fetch(`/api/humor-flavors/${flavorId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      })
      const stepsData = await stepsRes.json()
      if (!stepsRes.ok) throw new Error(stepsData.error ?? 'Failed to save steps')
      setSaveSuccess(true)
      await loadFlavors()
      if (creating) {
        setCreating(false)
        await openFlavor(flavorId)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`Delete "${selected.slug}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/humor-flavors/${selected.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error ?? 'Failed to delete')
        return
      }
      await loadFlavors()
      setView('list')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = flavors.filter(f => {
    const q = search.toLowerCase()
    return f.slug.toLowerCase().includes(q) || (f.description ?? '').toLowerCase().includes(q)
  })

  const canSave = creating ? (!!name && !!slug) : true
  const displaySlug = creating ? slug : selected?.slug ?? ''

  // ── List view ──────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="flex flex-1 items-start justify-center overflow-y-auto bg-gray-50 px-6 py-10">
        <div className="w-full max-w-3xl">
          {/* Header row */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Humor Flavors</h1>
            <button
              onClick={openCreate}
              className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              + New Flavor
            </button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or description…"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-black focus:outline-none"
            />
          </div>

          {/* Cards */}
          {loadingList ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : listError ? (
            <div className="py-16 text-center text-sm text-red-500">{listError}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              {search ? 'No flavors match your search.' : 'No flavors yet. Create one!'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {filtered.map(f => (
                <button
                  key={f.id}
                  onClick={() => openFlavor(f.id)}
                  className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-1 font-semibold text-gray-900">{f.slug}</div>
                  {f.description && (
                    <div className="line-clamp-2 text-xs text-gray-500">{f.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Edit view ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto bg-gray-50 px-6 py-10">
      <div className="w-full max-w-2xl">
        {/* Back + actions */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back
          </button>
          {!creating && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 disabled:opacity-40"
            >
              {deleting ? 'Deleting…' : 'Delete flavor'}
            </button>
          )}
        </div>

        <h2 className="mb-6 text-xl font-bold text-gray-900">
          {creating ? 'New Humor Flavor' : selected?.slug}
        </h2>

        {/* Flavor metadata */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Flavor Details</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Name {!creating && <span className="text-gray-400">(enter to rename)</span>}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder={creating ? 'e.g. Dry Wit' : selected?.slug}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Slug (auto-generated)</label>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                {displaySlug || <span className="italic text-gray-300">will appear here</span>}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the humor style…"
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Prompt Steps (executed in order)</h3>
          {steps.map((step, idx) => {
            const isStep1 = idx === 0
            const supportsTemp = (stepOptions.models.find(m => m.id === step.llm_model_id) as LookupItem | undefined)?.is_temperature_supported ?? true

            return (
              <div
                key={step.order_by}
                className={`rounded-xl border bg-white p-5 shadow-sm ${isStep1 ? 'border-blue-200' : 'border-gray-200'}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isStep1 ? 'bg-blue-600' : 'bg-gray-900'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">Step {idx + 1}</span>
                    {isStep1 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Image Description
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Model</label>
                    <select
                      value={step.llm_model_id}
                      onChange={e => updateStep(idx, { llm_model_id: Number(e.target.value) })}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                    >
                      {stepOptions.models.map(m => (
                        <option key={m.id} value={m.id}>{labelFor(m)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Input Type</label>
                    {isStep1 ? (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-500">Image &amp; Text</div>
                    ) : (
                      <select
                        value={step.llm_input_type_id}
                        onChange={e => updateStep(idx, { llm_input_type_id: Number(e.target.value) })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                      >
                        {stepOptions.inputTypes.map(t => (
                          <option key={t.id} value={t.id}>{labelFor(t)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Output Type</label>
                    <select
                      value={step.llm_output_type_id}
                      onChange={e => updateStep(idx, { llm_output_type_id: Number(e.target.value) })}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                    >
                      {stepOptions.outputTypes.map(t => (
                        <option key={t.id} value={t.id}>{labelFor(t)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Step Type</label>
                    {isStep1 ? (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-500">Image Description</div>
                    ) : (
                      <select
                        value={step.humor_flavor_step_type_id}
                        onChange={e => updateStep(idx, { humor_flavor_step_type_id: Number(e.target.value) })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                      >
                        {stepOptions.stepTypes.map(t => (
                          <option key={t.id} value={t.id}>{labelFor(t)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {supportsTemp && (
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Temperature <span className="text-gray-400">(0–2, leave blank for default)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={step.llm_temperature ?? ''}
                      onChange={e => updateStep(idx, {
                        llm_temperature: e.target.value === '' ? null : Number(e.target.value),
                      })}
                      placeholder="e.g. 1.0"
                      className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">System Prompt</label>
                    <textarea
                      value={step.llm_system_prompt}
                      onChange={e => updateStep(idx, { llm_system_prompt: e.target.value })}
                      placeholder={isStep1 ? 'You are an expert image analyst…' : 'You are a…'}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">User Prompt</label>
                    <textarea
                      value={step.llm_user_prompt}
                      onChange={e => updateStep(idx, { llm_user_prompt: e.target.value })}
                      placeholder={isStep1 ? 'Describe this image in thorough detail…' : 'Given the image description, generate…'}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Save */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Flavor'}
          </button>
          {saveSuccess && <span className="text-sm text-green-600">Saved successfully!</span>}
          {saveError && <span className="text-sm text-red-600">{saveError}</span>}
        </div>
      </div>
    </div>
  )
}
