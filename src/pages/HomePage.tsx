import { useMemo, useState } from 'react'
import { FireMap } from '../components/FireMap'
import { FireDetails } from '../components/FireDetails'
import { FireList } from '../components/FireList'
import { StatCards } from '../components/StatCards'
import { DemoBadge } from '../components/badges'
import { computeStats, groupByWilaya, sortFires } from '../lib/filters'
import { formatNumber, formatRelative, formatWilayaCount } from '../lib/format'
import { navigateTo } from '../hooks/useHashRoute'
import type { Fire, FiresPayload } from '../types'

export function HomePage({
  payload,
  loading,
  error,
  onRefresh,
}: {
  payload: FiresPayload | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}) {
  const [selected, setSelected] = useState<Fire | null>(null)

  const fires = payload?.fires ?? []
  const stats = useMemo(() => computeStats(fires), [fires])
  const activeFires = useMemo(
    () => sortFires(fires.filter((fire) => fire.status === 'active')),
    [fires],
  )
  const wilayaGroups = useMemo(
    () => groupByWilaya(fires.filter((fire) => fire.status === 'active')),
    [fires],
  )

  return (
    <div className="mx-auto max-w-lg px-3 pb-4">
      {payload?.isDemo && (
        <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-400/35 bg-amber-400/10 p-3 text-sm text-amber-200">
          <span aria-hidden="true">⚠️</span>
          <p className="leading-relaxed">
            <strong className="font-bold">بيانات تجريبية.</strong> لم يُضبط مصدر بيانات مباشر، لذلك
            المعروض أمثلة توضيحية فقط <span className="font-bold">وليست حرائق حقيقية</span>. للحالات
            الطارئة اتصل بالحماية المدنية على <span className="num font-bold">14</span>.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 rounded-lg border border-red-400/40 px-2.5 py-1 font-bold"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      <StatCards stats={stats} updatedAt={payload?.updatedAt ?? new Date().toISOString()} />

      <button
        type="button"
        onClick={() => navigateTo('report')}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-4 text-lg font-bold text-white shadow-lg shadow-red-900/40 active:bg-red-700"
      >
        <span aria-hidden="true">🔥</span>
        أبلغ عن حريق
      </button>

      <section className="mt-4" aria-label="خريطة الحرائق">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">خريطة الجزائر</h2>
          <button
            type="button"
            onClick={() => navigateTo('map')}
            className="rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1 text-xs font-bold text-ink-200 active:bg-ink-700"
          >
            عرض كامل
          </button>
        </div>
        <FireMap
          fires={fires}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          className="h-[58vh] min-h-72 w-full overflow-hidden rounded-2xl border border-ink-700"
        />
        <MapLegend />
      </section>

      <section className="mt-5" aria-label="الولايات المتضررة">
        <h2 className="mb-2 text-base font-bold text-white">
          📍 الولايات المتضررة
          <span className="ms-2 text-sm font-normal text-ink-400">
            {formatWilayaCount(wilayaGroups.length)}
          </span>
        </h2>
        {wilayaGroups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-700 p-5 text-center text-sm text-ink-400">
            {loading ? 'جارٍ التحميل…' : 'لا توجد حرائق نشطة مسجّلة حالياً.'}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {wilayaGroups.map((group) => (
              <li key={group.wilaya}>
                <button
                  type="button"
                  onClick={() => setSelected(group.worst)}
                  className="w-full rounded-xl border border-ink-700 bg-ink-800/60 p-2.5 text-start active:bg-ink-700"
                >
                  <p className="truncate font-bold text-white">{group.wilaya}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    نشطة: <span className="num">{group.active}</span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5" aria-label="أحدث الحرائق النشطة">
        <h2 className="mb-2 text-base font-bold text-white">🔥 الحرائق النشطة</h2>
        <FireList
          fires={activeFires.slice(0, 8)}
          onSelect={setSelected}
          emptyText={loading ? 'جارٍ التحميل…' : 'لا توجد حرائق نشطة مسجّلة حالياً.'}
        />
        {activeFires.length > 8 && (
          <button
            type="button"
            onClick={() => navigateTo('map')}
            className="mt-2.5 w-full rounded-xl border border-ink-700 bg-ink-800/60 py-2.5 text-sm font-bold text-ink-200 active:bg-ink-700"
          >
            عرض الكل على الخريطة
          </button>
        )}
      </section>

      <footer className="mt-6 space-y-1 text-center text-xs text-ink-400">
        <p>
          المصدر: {payload?.sourceLabel ?? '—'} {payload?.isDemo && <DemoBadge className="ms-1" />}
        </p>
        <p>
          آخر تحديث: {payload ? formatRelative(payload.updatedAt) : '—'} ·{' '}
          <span className="num">{formatNumber(stats.satellite)}</span> نقطة رصد فضائي غير مؤكدة
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="mt-1 rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 font-bold text-ink-200 disabled:opacity-50"
        >
          {loading ? 'جارٍ التحديث…' : 'تحديث البيانات'}
        </button>
      </footer>

      {selected && <FireDetails fire={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export function MapLegend() {
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
      <li>🟠 متوسط</li>
      <li>🔴 خطير</li>
      <li>🟣 حرج</li>
      <li className="flex items-center gap-1">
        <span
          className="inline-block size-3 rounded-full border-2 border-dashed border-white/60"
          aria-hidden="true"
        />
        حدود متقطّعة = رصد فضائي غير مؤكد
      </li>
    </ul>
  )
}
