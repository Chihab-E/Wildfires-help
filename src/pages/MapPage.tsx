import { useMemo, useState } from 'react'
import { FireMap } from '../components/FireMap'
import { FireDetails } from '../components/FireDetails'
import { FilterBar } from '../components/FilterBar'
import { FireList } from '../components/FireList'
import { applyFilter, sortFires } from '../lib/filters'
import { formatFireCount } from '../lib/format'
import type { FilterKey, Fire, FiresPayload } from '../types'

export function MapPage({
  payload,
  loading,
}: {
  payload: FiresPayload | null
  loading: boolean
}) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selected, setSelected] = useState<Fire | null>(null)
  const [listOpen, setListOpen] = useState(false)

  const fires = payload?.fires ?? []

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({
      all: applyFilter(fires, 'all').length,
      active: applyFilter(fires, 'active').length,
      verified: applyFilter(fires, 'verified').length,
      recent: applyFilter(fires, 'recent').length,
    }),
    [fires],
  )

  const visible = useMemo(() => applyFilter(fires, filter), [fires, filter])
  const sorted = useMemo(() => sortFires(visible), [visible])

  return (
    <div className="relative h-[calc(100dvh-7.5rem)]">
      <FireMap
        fires={visible}
        selectedId={selected?.id ?? null}
        onSelect={(fire) => {
          setSelected(fire)
          setListOpen(false)
        }}
        className="map-inset absolute inset-0"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] p-2.5">
        <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-ink-700 bg-ink-900/92 p-2 backdrop-blur">
          <FilterBar value={filter} counts={counts} onChange={setFilter} />
        </div>
      </div>

      {/* يبقى فوق القائمة المفتوحة حتى يمكن طيّها */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1200] p-2.5">
        <button
          type="button"
          onClick={() => {
            setListOpen((open) => !open)
            setSelected(null)
          }}
          className="pointer-events-auto mx-auto flex w-full max-w-lg items-center justify-between rounded-2xl border border-ink-700 bg-ink-900/92 px-4 py-2.5 text-sm font-bold text-ink-200 backdrop-blur active:bg-ink-800"
          aria-expanded={listOpen}
        >
          <span>
            {loading && fires.length === 0
              ? 'جارٍ التحميل…'
              : `عرض ${formatFireCount(visible.length)}`}
          </span>
          <span aria-hidden="true">{listOpen ? '▾' : '▴'}</span>
        </button>
      </div>

      {listOpen && (
        <div className="absolute inset-x-0 bottom-0 z-[1150] max-h-[60%] overflow-y-auto rounded-t-2xl border-t border-ink-700 bg-ink-900/97 p-3 pb-20 backdrop-blur">
          <FireList
            fires={sorted}
            onSelect={(fire) => {
              setSelected(fire)
              setListOpen(false)
            }}
          />
        </div>
      )}

      {selected && <FireDetails fire={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
