import { useEffect } from 'react'
import { SeverityBadge, StatusBadge, VerificationBadge } from './badges'
import { SOURCE_KIND_LABEL, formatDateTime, formatRelative } from '../lib/format'
import type { Fire } from '../types'

interface Row {
  label: string
  value: React.ReactNode
}

/** لوحة سفلية تعرض تفاصيل الحريق المختار. */
export function FireDetails({ fire, onClose }: { fire: Fire; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rows: Row[] = [
    { label: 'الولاية', value: fire.wilaya },
    { label: 'البلدية', value: fire.commune },
    { label: 'الشدة', value: <SeverityBadge severity={fire.severity} /> },
    {
      label: 'وقت الإبلاغ',
      value: (
        <span className="block">
          {formatRelative(fire.reportedAt)}
          <span className="mt-0.5 block text-xs font-normal text-ink-400">
            <span className="num">{formatDateTime(fire.reportedAt)}</span>
          </span>
        </span>
      ),
    },
    { label: 'الحالة', value: <StatusBadge status={fire.status} /> },
    { label: 'المصدر', value: fire.sourceName },
  ]

  // لا نكرّر النوع إن كان اسم المصدر هو النوع نفسه
  if (fire.sourceName !== SOURCE_KIND_LABEL[fire.sourceKind]) {
    rows.push({ label: 'نوع المصدر', value: SOURCE_KIND_LABEL[fire.sourceKind] })
  }

  if (fire.confidence !== undefined) {
    rows.push({
      label: 'ثقة الرصد',
      value: <span className="num">{Math.round(fire.confidence)}%</span>,
    })
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1200] flex justify-center px-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-4">
      <section
        className="pointer-events-auto w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900/97 p-4 shadow-2xl backdrop-blur"
        role="dialog"
        aria-modal="false"
        aria-label={`تفاصيل حريق ${fire.wilaya}`}
      >
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-white">
              {fire.wilaya} — {fire.commune}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <VerificationBadge fire={fire} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 shrink-0 rounded-full border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-ink-200 active:bg-ink-700"
            aria-label="إغلاق التفاصيل"
          >
            إغلاق
          </button>
        </header>

        <dl className="divide-y divide-ink-700/70 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-2">
              <dt className="shrink-0 text-ink-400">{row.label}</dt>
              <dd className="text-end font-medium text-ink-200">{row.value}</dd>
            </div>
          ))}
        </dl>

        {fire.notes && (
          <p className="mt-3 rounded-xl bg-ink-800/70 p-3 text-sm leading-relaxed text-ink-200">
            {fire.notes}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            className="flex-1 rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-center text-sm font-medium text-ink-200 active:bg-ink-700"
            href={`https://www.openstreetmap.org/?mlat=${fire.lat}&mlon=${fire.lon}#map=13/${fire.lat}/${fire.lon}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            فتح الموقع في الخريطة
          </a>
          {fire.sourceUrl && (
            <a
              className="flex-1 rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-center text-sm font-medium text-ink-200 active:bg-ink-700"
              href={fire.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              مصدر المعلومة
            </a>
          )}
        </div>

        <p className="num mt-3 text-center text-xs text-ink-400">
          {fire.lat.toFixed(4)}, {fire.lon.toFixed(4)}
        </p>
      </section>
    </div>
  )
}
