'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    setSubmitting(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) setError(authError.message)
    setSubmitting(false)
  }

  const onLogout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-xl font-bold">Sign in</h1>
          <form onSubmit={onLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <span className="text-sm text-gray-600">{session.user.email}</span>
        <button
          onClick={onLogout}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
      {children}
    </>
  )
}
