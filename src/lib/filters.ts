import { config } from './config'
import { SEVERITY_RANK } from './format'
import type { FilterKey, Fire } from '../types'

/** هل الحريق ضمن نافذة «حديث»؟ */
export function isRecent(fire: Fire, now: number = Date.now()): boolean {
  const time = new Date(fire.reportedAt).getTime()
  if (Number.isNaN(time)) return false
  return now - time <= config.recentHours * 60 * 60 * 1000
}

/** يطبّق المرشّح المختار على قائمة الحرائق. */
export function applyFilter(fires: Fire[], filter: FilterKey, now: number = Date.now()): Fire[] {
  switch (filter) {
    case 'active':
      return fires.filter((fire) => fire.status === 'active')
    case 'verified':
      return fires.filter((fire) => fire.verified)
    case 'recent':
      return fires.filter((fire) => isRecent(fire, now))
    case 'all':
      return fires
  }
}

/** الأخطر أولاً، ثم الأحدث. */
export function sortFires(fires: Fire[]): Fire[] {
  return [...fires].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    if (bySeverity !== 0) return bySeverity
    return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
  })
}

export interface FireStats {
  total: number
  active: number
  critical: number
  verified: number
  satellite: number
  /** أسماء الولايات التي بها حرائق نشطة */
  affectedWilayas: string[]
}

export function computeStats(fires: Fire[]): FireStats {
  const affected = new Set<string>()
  let active = 0
  let critical = 0
  let verified = 0
  let satellite = 0

  for (const fire of fires) {
    if (fire.status === 'active') {
      active++
      affected.add(fire.wilaya)
    }
    if (fire.severity === 'critical') critical++
    if (fire.verified) verified++
    if (fire.sourceKind === 'satellite') satellite++
  }

  return {
    total: fires.length,
    active,
    critical,
    verified,
    satellite,
    affectedWilayas: [...affected].sort((a, b) => a.localeCompare(b, 'ar')),
  }
}

/** تجميع الحرائق حسب الولاية مرتبة بعدد الحرائق النشطة. */
export interface WilayaGroup {
  wilaya: string
  wilayaCode: string
  total: number
  active: number
  worst: Fire
}

export function groupByWilaya(fires: Fire[]): WilayaGroup[] {
  const groups = new Map<string, WilayaGroup>()

  for (const fire of fires) {
    const existing = groups.get(fire.wilaya)
    if (!existing) {
      groups.set(fire.wilaya, {
        wilaya: fire.wilaya,
        wilayaCode: fire.wilayaCode,
        total: 1,
        active: fire.status === 'active' ? 1 : 0,
        worst: fire,
      })
      continue
    }

    existing.total++
    if (fire.status === 'active') existing.active++
    if (SEVERITY_RANK[fire.severity] > SEVERITY_RANK[existing.worst.severity]) {
      existing.worst = fire
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (b.active !== a.active) return b.active - a.active
    return b.total - a.total
  })
}
