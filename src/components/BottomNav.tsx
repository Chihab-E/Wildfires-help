import type { Route } from '../hooks/useHashRoute'

const ITEMS: { route: Route; label: string; icon: string }[] = [
  { route: 'home', label: 'الرئيسية', icon: '🏠' },
  { route: 'map', label: 'الخريطة', icon: '🗺️' },
  { route: 'report', label: 'أبلغ عن حريق', icon: '🔥' },
  { route: 'emergency', label: 'الطوارئ', icon: '🚨' },
]

export function BottomNav({
  current,
  onNavigate,
}: {
  current: Route
  onNavigate: (route: Route) => void
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1300] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="التنقّل الرئيسي"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((item) => {
          const active = item.route === current
          const isReport = item.route === 'report'
          return (
            <li key={item.route} className="flex-1">
              <button
                type="button"
                onClick={() => onNavigate(item.route)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-[4.25rem] w-full flex-col items-center justify-center gap-1 text-[13px] font-bold leading-none transition-colors ${
                  active
                    ? isReport
                      ? 'text-red-400'
                      : 'text-strong'
                    : isReport
                      ? 'text-red-400/80'
                      : 'text-muted'
                }`}
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="px-0.5 text-center">{item.label}</span>
                <span
                  className={`mt-0.5 h-0.5 w-6 rounded-full ${active ? 'bg-current' : 'bg-transparent'}`}
                  aria-hidden="true"
                />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
