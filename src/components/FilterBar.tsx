import { FILTER_LABEL } from '../lib/format'
import type { FilterKey } from '../types'

const ORDER: FilterKey[] = ['all', 'active', 'verified', 'recent']

export function FilterBar({
  value,
  counts,
  onChange,
  className = '',
}: {
  value: FilterKey
  counts: Record<FilterKey, number>
  onChange: (next: FilterKey) => void
  className?: string
}) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto ${className}`}
      role="tablist"
      aria-label="مرشّحات الحرائق"
    >
      {ORDER.map((key) => {
        const selected = key === value
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${
              selected
                ? 'border-red-500/60 bg-red-500/20 text-red-200'
                : 'border-ink-700 bg-ink-800/80 text-ink-400 active:bg-ink-700'
            }`}
          >
            {FILTER_LABEL[key]}
            <span className="ms-1.5 text-xs opacity-70">
              <span className="num">{counts[key]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
