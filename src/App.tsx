import { useEffect } from 'react'
import { BottomNav } from './components/BottomNav'
import { HomePage } from './pages/HomePage'
import { MapPage } from './pages/MapPage'
import { EmergencyPage } from './pages/EmergencyPage'
import { useFires } from './hooks/useFires'
import { useHashRoute, type Route } from './hooks/useHashRoute'
import { formatRelative } from './lib/format'

const TITLES: Record<Route, string> = {
  home: 'Algeria Fire',
  map: 'الخريطة',
  emergency: 'معلومات الطوارئ',
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const { data, loading, error, refresh } = useFires()

  // العودة لأعلى الصفحة عند تبديل التبويب
  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.title =
      route === 'home' ? 'Algeria Fire — حرائق الجزائر' : `${TITLES[route]} — Algeria Fire`
  }, [route])

  // «آخر تحديث» وزر التحديث لا معنى لهما في صفحة الطوارئ
  const showsData = route === 'home' || route === 'map'

  return (
    <div className="min-h-dvh bg-canvas pb-[4.75rem]">
      <header className="sticky top-0 z-[1250] border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xl leading-none" aria-hidden="true">
              🔥
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-strong">{TITLES[route]}</h1>
              <p className="truncate text-[13px] leading-tight text-muted">
                {showsData
                  ? loading && !data
                    ? 'جارٍ تحميل البيانات…'
                    : data
                      ? `آخر تحديث ${formatRelative(data.updatedAt)}`
                      : 'لا توجد بيانات'
                  : 'حرائق الجزائر'}
              </p>
            </div>
          </div>

          {showsData && (
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="shrink-0 rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-xs font-bold text-body active:bg-raised disabled:opacity-50"
              aria-label="تحديث البيانات"
            >
              {loading ? '…' : '⟳ تحديث'}
            </button>
          )}
        </div>
      </header>

      <main>
        {route === 'home' && (
          <HomePage payload={data} loading={loading} error={error} onRefresh={refresh} />
        )}
        {route === 'map' && <MapPage payload={data} loading={loading} />}
        {route === 'emergency' && <EmergencyPage />}
      </main>

      <BottomNav current={route} onNavigate={navigate} />
    </div>
  )
}
