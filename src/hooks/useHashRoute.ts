import { useEffect, useState } from 'react'

/** صفحات التطبيق. */
export const ROUTES = ['home', 'map', 'report', 'emergency'] as const
export type Route = (typeof ROUTES)[number]

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return (ROUTES as readonly string[]).includes(raw) ? (raw as Route) : 'home'
}

/** موجّه بسيط قائم على `location.hash` — بلا مكتبة توجيه. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = (next: Route) => {
    if (parseHash() === next) {
      setRoute(next)
      return
    }
    window.location.hash = `#/${next}`
  }

  return [route, navigate]
}

/** ينتقل إلى صفحة من أي مكان في الشجرة. */
export function navigateTo(route: Route): void {
  window.location.hash = `#/${route}`
}
