import { formatNumber, formatPointCount, formatRelative } from '../lib/format'
import type { FireStats } from '../lib/filters'

function Card({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: string
  label: string
  value: string
  hint?: string
  tone: 'red' | 'amber' | 'slate'
}) {
  const tones = {
    red: 'border-red-200 bg-red-50',
    amber: 'border-amber-200 bg-amber-50',
    slate: 'border-line bg-surface',
  } as const

  return (
    <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
        <span aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-1.5 truncate text-2xl font-bold text-strong">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function StatCards({ stats, updatedAt }: { stats: FireStats; updatedAt: string }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <Card
        icon="🔥"
        label="حرائق نشطة"
        value={formatNumber(stats.active)}
        hint={stats.critical > 0 ? `منها ${formatNumber(stats.critical)} بشدة حرجة` : undefined}
        tone="red"
      />
      <Card
        icon="📍"
        label="ولايات متضررة"
        value={formatNumber(stats.affectedWilayas.length)}
        hint={stats.affectedWilayas.slice(0, 2).join('، ') || undefined}
        tone="amber"
      />
      {/* البطاقة الثالثة تملأ السطر على الهاتف بدل ترك فراغ */}
      <div className="col-span-2 sm:col-span-1">
        <Card
          icon="🕒"
          label="آخر تحديث"
          value={formatRelative(updatedAt)}
          hint={`${formatPointCount(stats.total)} مسجّلة`}
          tone="slate"
        />
      </div>
    </div>
  )
}
