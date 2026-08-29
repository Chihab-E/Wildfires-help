import { SeverityBadge, StatusBadge, VerificationBadge } from './badges'
import { formatRelative } from '../lib/format'
import type { Fire } from '../types'

export function FireListItem({ fire, onSelect }: { fire: Fire; onSelect?: (fire: Fire) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(fire)}
      className="w-full rounded-2xl border border-ink-700 bg-ink-800/60 p-3 text-start transition-colors active:bg-ink-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-white">
            {fire.wilaya} <span className="text-ink-400">—</span> {fire.commune}
          </p>
          <p className="mt-0.5 text-xs text-ink-400">{formatRelative(fire.reportedAt)}</p>
        </div>
        <SeverityBadge severity={fire.severity} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusBadge status={fire.status} />
        <VerificationBadge fire={fire} />
      </div>
    </button>
  )
}

export function FireList({
  fires,
  onSelect,
  emptyText = 'لا توجد حرائق مطابقة.',
}: {
  fires: Fire[]
  onSelect?: (fire: Fire) => void
  emptyText?: string
}) {
  if (fires.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-ink-700 p-6 text-center text-sm text-ink-400">
        {emptyText}
      </p>
    )
  }

  return (
    <ul className="space-y-2.5">
      {fires.map((fire) => (
        <li key={fire.id}>
          <FireListItem fire={fire} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}
