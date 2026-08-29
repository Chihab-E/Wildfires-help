import { SEVERITY_COLOR, SEVERITY_EMOJI, SEVERITY_LABEL, STATUS_LABEL } from '../lib/format'
import type { Fire, FireStatus, Severity } from '../types'

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
      style={{
        color: SEVERITY_COLOR[severity],
        background: `${SEVERITY_COLOR[severity]}1f`,
        border: `1px solid ${SEVERITY_COLOR[severity]}55`,
      }}
    >
      <span aria-hidden="true">{SEVERITY_EMOJI[severity]}</span>
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

const STATUS_STYLE: Record<FireStatus, string> = {
  active: 'text-red-700 bg-red-50 border-red-200',
  contained: 'text-amber-800 bg-amber-50 border-amber-200',
  extinguished: 'text-muted bg-subtle border-line',
}

export function StatusBadge({ status }: { status: FireStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}
    >
      {status === 'active' && (
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {STATUS_LABEL[status]}
    </span>
  )
}

/**
 * الشارة الأهم في التطبيق: تفصل الرصد الفضائي غير المؤكد
 * عن الحرائق المؤكدة ميدانياً.
 */
export function VerificationBadge({ fire }: { fire: Fire }) {
  if (fire.verified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
        ✓ مؤكد ميدانياً
      </span>
    )
  }

  if (fire.sourceKind === 'satellite') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">
        🛰️ رصد فضائي — غير مؤكد
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-subtle px-2 py-0.5 text-xs font-bold text-muted">
      ⚠️ بلاغ غير مؤكد
    </span>
  )
}

export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 ${className}`}
    >
      بيانات تجريبية
    </span>
  )
}
