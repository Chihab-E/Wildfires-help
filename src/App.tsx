import { useEffect } from 'react'
import { BottomNav } from './components/BottomNav'
import { HomePage } from './pages/HomePage'
import { MapPage } from './pages/MapPage'
import { ReportPage } from './pages/ReportPage'
import { EmergencyPage } from './pages/EmergencyPage'
import { useFires } from './hooks/useFires'
import { useHashRoute, type Route } from './hooks/useHashRoute'
import { flushQueuedReports } from './lib/api'
import { formatRelative } from './lib/format'

const TITLES: Record<Route, string> = {
  home: 'حرائق الجزائر',
  map: 'الخريطة',
  report: 'أبلغ عن حريق',
  emergency: 'معلومات الطوارئ',
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const { data, loading, error, refresh } = useFires()

  // العودة لأعلى الصفحة عند تبديل التبويب
  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.title =
      route === 'home' ? 'حرائق الجزائر — تتبع وإبلاغ' : `${TITLES[route]} — حرائق الجزائر`
  }, [route])

  // إعادة إرسال البلاغات التي تعذّر إرسالها سابقاً
  useEffect(() => {
    void flushQueuedReports()
    const onOnline = () => void flushQueuedReports()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    <div className="min-h-dvh bg-ink-950 pb-16">
      <header className="sticky top-0 z-[1250] border-b border-ink-700 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xl leading-none" aria-hidden="true">
              🔥
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-white">{TITLES[route]}</h1>
              <p className="truncate text-[11px] text-ink-400">
                {loading && !data
                  ? 'جارٍ تحميل البيانات…'
                  : data
                    ? `آخر تحديث ${formatRelative(data.updatedAt)}`
                    : 'لا توجد بيانات'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="shrink-0 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-bold text-ink-200 active:bg-ink-700 disabled:opacity-50"
            aria-label="تحديث البيانات"
          >
            {loading ? '…' : '⟳ تحديث'}
          </button>
        </div>
      </header>

      <main>
        {route === 'home' && (
          <HomePage payload={data} loading={loading} error={error} onRefresh={refresh} />
        )}
        {route === 'map' && <MapPage payload={data} loading={loading} />}
        {route === 'report' && <ReportPage />}
        {route === 'emergency' && <EmergencyPage />}
      </main>

      <BottomNav current={route} onNavigate={navigate} />
    </div>
  )
}
