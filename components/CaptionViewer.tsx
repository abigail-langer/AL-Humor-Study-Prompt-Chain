'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type ImageRow = {
  id: string
  url: string | null
  image_description: string | null
  additional_context: string | null
}

type CaptionRow = {
  id: string
  content: string | null
  created_datetime_utc: string
  like_count: number
  is_featured: boolean
  images: ImageRow | null
}

type CaptionsPage = {
  items: CaptionRow[]
  nextCursor: { cursor_ts: string; cursor_id: string } | null
  hasMore: boolean
}

// ── CaptionCard ───────────────────────────────────────────────────────────────

function CaptionCard({ caption }: { caption: CaptionRow }) {
  const image = caption.images
  const [imgError, setImgError] = useState(false)

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-violet-100 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-violet-50 dark:bg-gray-800">
        {image?.url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.image_description ?? 'Caption image'}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-10 w-10 text-violet-200 dark:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {caption.is_featured && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
            Featured
          </span>
        )}
      </div>

      {/* Caption text + meta */}
      <div className="flex flex-1 flex-col justify-between gap-2 p-3">
        <p className="text-sm leading-snug text-violet-900 dark:text-gray-100">
          {caption.content ?? <span className="italic text-violet-300 dark:text-gray-600">No caption text</span>}
        </p>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-violet-400 dark:text-gray-500">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
            </svg>
            {caption.like_count}
          </span>
          <span className="text-[10px] text-violet-300 dark:text-gray-600">
            {new Date(caption.created_datetime_utc).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <svg className="h-6 w-6 animate-spin text-violet-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

// ── CaptionViewer (inline) ────────────────────────────────────────────────────

type Props = {
  flavorId: string
}

export default function CaptionViewer({ flavorId }: Props) {
  const [captions, setCaptions] = useState<CaptionRow[]>([])
  const [nextCursor, setNextCursor] = useState<{ cursor_ts: string; cursor_id: string } | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const fetchPage = useCallback(async (cursor?: { cursor_ts: string; cursor_id: string }) => {
    const url = new URL(`/api/humor-flavors/${flavorId}/captions`, window.location.origin)
    if (cursor) {
      url.searchParams.set('cursor_ts', cursor.cursor_ts)
      url.searchParams.set('cursor_id', cursor.cursor_id)
    }
    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    return res.json() as Promise<CaptionsPage>
  }, [flavorId])

  const doInitialLoad = useCallback(() => {
    setLoading(true)
    setError(null)
    setCaptions([])
    setNextCursor(null)
    setHasMore(false)
    let cancelled = false
    fetchPage()
      .then(page => {
        if (cancelled) return
        setCaptions(page.items)
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fetchPage])

  useEffect(() => doInitialLoad(), [doInitialLoad])

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchPage(nextCursor)
      setCaptions(prev => [...prev, ...page.items])
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, hasMore, nextCursor, loadingMore])

  useEffect(() => {
    observerRef.current?.disconnect()
    if (!sentinelRef.current || !hasMore) return
    observerRef.current = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loadMore])

  return (
    <div className="rounded-xl border border-violet-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-violet-100 px-5 py-4 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-violet-700 dark:text-gray-300">Captions</h3>
        {!loading && !error && (
          <span className="text-xs text-violet-400 dark:text-gray-500">
            {captions.length} loaded{hasMore ? ' · scroll for more' : ' · all loaded'}
          </span>
        )}
      </div>

      <div className="p-5">
        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-violet-100 bg-white dark:border-gray-700 dark:bg-gray-900">
                <div className="aspect-[4/3] w-full bg-violet-100 dark:bg-gray-800" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-full rounded bg-violet-100 dark:bg-gray-800" />
                  <div className="h-3 w-3/4 rounded bg-violet-100 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center py-12 text-center">
            <svg className="mb-3 h-10 w-10 text-red-300 dark:text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm font-medium text-red-500">{error}</p>
            <button
              onClick={doInitialLoad}
              className="mt-4 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-transparent dark:hover:bg-red-900/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && captions.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <svg className="mb-3 h-12 w-12 text-violet-200 dark:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-medium text-violet-500 dark:text-gray-400">No captions yet for this flavor.</p>
            <p className="mt-1 text-xs text-violet-400 dark:text-gray-500">Captions will appear here once the pipeline has run.</p>
          </div>
        )}

        {/* Caption grid */}
        {!loading && !error && captions.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {captions.map(caption => (
                <CaptionCard key={caption.id} caption={caption} />
              ))}
            </div>

            <div ref={sentinelRef} className="mt-6">
              {loadingMore && <Spinner />}
              {!loadingMore && hasMore && (
                <div className="flex justify-center">
                  <button
                    onClick={loadMore}
                    className="rounded-lg border border-violet-200 bg-white px-5 py-2 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-50 dark:border-gray-600 dark:bg-gray-800 dark:text-violet-400 dark:hover:bg-gray-700"
                  >
                    Load more
                  </button>
                </div>
              )}
              {!hasMore && (
                <p className="text-center text-xs text-violet-300 dark:text-gray-600">All captions loaded</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
