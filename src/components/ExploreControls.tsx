'use client'

import { useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CREATOR_CATEGORIES, type CreatorCategory } from '@/lib/types'
import { EXPLORE_SORTS, type ExploreSort } from '@/lib/explore'
import { useTranslations } from '@/lib/i18n'

const SEARCH_DEBOUNCE_MS = 350

type ExploreControlsProps = {
  query: string
  activeCategory: CreatorCategory | null
  activeTag: string
  activeSort: ExploreSort
  categories: CreatorCategory[]
  disabled?: boolean
}

export default function ExploreControls({
  query,
  activeCategory,
  activeTag,
  activeSort,
  categories,
  disabled,
}: ExploreControlsProps) {
  const router = useRouter()
  const t = useTranslations()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appliedQueryRef = useRef(query)

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  // External resets (Clear filters, back/forward) change the query prop without
  // touching the uncontrolled input - mirror it so the box never shows stale
  // text. Compared against the last applied query, not the live text, so the
  // slow server round-trip after a debounced search can't revert fresh typing.
  useEffect(() => {
    if (query === appliedQueryRef.current) return
    appliedQueryRef.current = query
    if (debounceRef.current || !inputRef.current) return
    inputRef.current.value = query
  }, [query])

  // Every control change rebuilds the full query string so filters compose -
  // picking a category never drops the search text, sorting keeps the tag, etc.
  function navigate(patch: { q?: string; cat?: string; tag?: string; sort?: string }) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      // A keystroke is still debounced - carry it over so a chip click never
      // silently drops text the user just typed.
      if (patch.q === undefined && inputRef.current) patch.q = inputRef.current.value
    }
    const q = (patch.q ?? query).trim()
    const cat = patch.cat ?? activeCategory ?? ''
    const tag = patch.tag ?? activeTag
    const sort = patch.sort ?? activeSort
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (cat) params.set('cat', cat)
    if (tag) params.set('tag', tag)
    if (sort !== 'trending') params.set('sort', sort)
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/explore?${qs}` : '/explore', { scroll: false })
    })
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      navigate({ q: value })
    }, SEARCH_DEBOUNCE_MS)
  }

  function clearSearch() {
    if (inputRef.current) inputRef.current.value = ''
    navigate({ q: '' })
  }

  return (
    <div aria-busy={isPending || undefined}>
      {categories.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 justify-center pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => navigate({ cat: activeCategory === cat ? '' : cat })}
              disabled={disabled}
              aria-pressed={activeCategory === cat}
              className={`explore-filter shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${activeCategory === cat ? 'explore-filter-active' : ''}`}
            >
              {CREATOR_CATEGORIES[cat].emoji} {t(`category_${cat}`)}
            </button>
          ))}
        </div>
      )}

      <form
        role="search"
        className="mt-4 flex flex-wrap items-center justify-center gap-2"
        onSubmit={event => {
          event.preventDefault()
          navigate({ q: inputRef.current?.value ?? '' })
        }}
      >
        <div className="relative">
          <input
            ref={inputRef}
            name="q"
            type="search"
            defaultValue={query || ''}
            placeholder={t('exploreSearch')}
            aria-label={t('exploreSearchLabel')}
            disabled={disabled}
            onChange={event => handleSearchChange(event.target.value)}
            className="explore-search w-60 rounded-full border py-1.5 pl-4 pr-8 text-xs font-semibold"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label={t('exploreClearSearch')}
              className="explore-search-clear absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>
      </form>

      <label className="mt-3 flex items-center justify-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('exploreFilter')}</span>
        <select
          value={activeSort}
          onChange={event => navigate({ sort: event.target.value })}
          disabled={disabled}
          title={t(`exploreSortHint_${activeSort}`)}
          className="explore-sort-select rounded-full border py-1.5 pl-3 pr-8 text-xs font-semibold"
        >
          {(Object.keys(EXPLORE_SORTS) as ExploreSort[]).map(sort => (
            <option key={sort} value={sort}>
              {t(`exploreSort_${sort}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
