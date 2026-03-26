'use client'

import { useCallback, useEffect, useState } from 'react'

type HumorFlavor = {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
}

type FlavorStep = {
  id?: string
  order_by: number
  llm_system_prompt: string
  llm_user_prompt: string
}

type FlavorWithSteps = HumorFlavor & { steps: FlavorStep[] }

const EMPTY_STEPS: FlavorStep[] = [
  { order_by: 1, llm_system_prompt: '', llm_user_prompt: '' },
  { order_by: 2, llm_system_prompt: '', llm_user_prompt: '' },
  { order_by: 3, llm_system_prompt: '', llm_user_prompt: '' },
]

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function FlavorBuilder() {
  const [flavors, setFlavors] = useState<HumorFlavor[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [selected, setSelected] = useState<FlavorWithSteps | null>(null)
  const [creating, setCreating] = useState(false)

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
    try {
      const res = await fetch('/api/humor-flavors')
      if (res.ok) {
        const data = await res.json()
        setFlavors(data)
      }
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadFlavors()
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
  }

  const openFlavor = async (id: string) => {
    setSaveError(null)
    setSaveSuccess(false)
    const res = await fetch(`/api/humor-flavors/${id}`)
    if (!res.ok) return
    const data: FlavorWithSteps = await res.json()
    setSelected(data)
    setCreating(false)
    setName(data.name)
    setSlug(data.slug)
    setDescription(data.description ?? '')
    // Merge fetched steps with empty template (always show 3)
    const merged = EMPTY_STEPS.map(template => {
      const existing = data.steps.find(s => s.order_by === template.order_by)
      return existing
        ? { order_by: template.order_by, llm_system_prompt: existing.llm_system_prompt ?? '', llm_user_prompt: existing.llm_user_prompt ?? '' }
        : { ...template }
    })
    setSteps(merged)
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (creating) setSlug(slugify(value))
  }

  const updateStep = (index: number, field: 'llm_system_prompt' | 'llm_user_prompt', value: string) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
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
          body: JSON.stringify({ name, slug, description }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to create flavor')
        flavorId = data.id
      } else {
        const res = await fetch(`/api/humor-flavors/${selected!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, description }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to update flavor')
        flavorId = selected!.id
      }

      // Save steps
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
    if (!confirm(`Delete "${selected.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/humor-flavors/${selected.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error ?? 'Failed to delete')
        return
      }
      setSelected(null)
      setCreating(false)
      await loadFlavors()
    } finally {
      setDeleting(false)
    }
  }

  const isEditing = creating || !!selected

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
        <div className="border-b border-gray-200 p-4">
          <button
            onClick={openCreate}
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            + New Flavor
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-4 text-sm text-gray-400">Loading…</div>
          ) : flavors.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">No flavors yet. Create one!</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {flavors.map(f => (
                <li key={f.id}>
                  <button
                    onClick={() => openFlavor(f.id)}
                    className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-white ${
                      selected?.id === f.id ? 'bg-white font-semibold text-gray-900' : 'text-gray-600'
                    }`}
                  >
                    <div className="font-medium">{f.name}</div>
                    <div className="mt-0.5 text-xs text-gray-400">{f.slug}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Main editor */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {!isEditing ? (
          <div className="flex h-48 flex-col items-center justify-center text-gray-400">
            <p className="text-sm">Select a flavor to edit or create a new one.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {creating ? 'New Humor Flavor' : name}
              </h2>
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

            {/* Flavor metadata */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700">Flavor Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="e.g. Dry Wit"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    placeholder="e.g. dry-wit"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
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
              {steps.map((step, idx) => (
                <div
                  key={step.order_by}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                      {idx + 1}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">Step {idx + 1}</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        System Prompt
                      </label>
                      <textarea
                        value={step.llm_system_prompt}
                        onChange={e => updateStep(idx, 'llm_system_prompt', e.target.value)}
                        placeholder="You are a…"
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        User Prompt
                      </label>
                      <textarea
                        value={step.llm_user_prompt}
                        onChange={e => updateStep(idx, 'llm_user_prompt', e.target.value)}
                        placeholder="Given the image, generate…"
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Save */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !name || !slug}
                className="rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Flavor'}
              </button>
              {saveSuccess && (
                <span className="text-sm text-green-600">Saved successfully!</span>
              )}
              {saveError && (
                <span className="text-sm text-red-600">{saveError}</span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
