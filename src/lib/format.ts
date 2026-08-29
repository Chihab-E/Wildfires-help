import type { FilterKey, FireStatus, Severity, SourceKind } from '../types'

/* ------------------------------- التسميات ------------------------------- */

export const SEVERITY_LABEL: Record<Severity, string> = {
  moderate: 'متوسط',
  serious: 'خطير',
  critical: 'حرج',
}

export const SEVERITY_EMOJI: Record<Severity, string> = {
  moderate: '🟠',
  serious: '🔴',
  critical: '🟣',
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  moderate: '#f59e0b',
  serious: '#ef4444',
  critical: '#a855f7',
}

/** ترتيب تنازلي للخطورة — يُستخدم في الفرز. */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  serious: 2,
  moderate: 1,
}

export const STATUS_LABEL: Record<FireStatus, string> = {
  active: 'نشط',
  contained: 'تحت السيطرة',
  extinguished: 'أُخمد',
}

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  satellite: 'رصد فضائي',
  official: 'مصدر رسمي',
  report: 'بلاغ مستخدم',
}

export const FILTER_LABEL: Record<FilterKey, string> = {
  all: 'الكل',
  active: 'نشط',
  verified: 'مؤكد',
  recent: 'حديث',
}

/* -------------------------------- الأوقات -------------------------------- */

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * التنسيق يدوي وليس عبر `Intl` عن قصد: مُنسّقات `Intl` بلغة عربية
 * تُدرج علامات اتجاه ثنائية تُشوّه عرض التاريخ داخل فقرة RTL.
 * الناتج هنا نص لاتيني خالص يُعرض داخل عنصر ‎`.num`‎ معزول الاتجاه.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** الوقت فقط. */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** صياغة عربية سليمة للمثنى والجمع. */
function arabicPlural(count: number, one: string, two: string, few: string, many: string): string {
  if (count === 1) return one
  if (count === 2) return two
  if (count >= 3 && count <= 10) return `${count} ${few}`
  return `${count} ${many}`
}

/** «منذ ساعتين»، «منذ 5 دقائق»… */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const diffMs = now - date.getTime()
  if (diffMs < 0) return 'الآن'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'الآن'
  if (minutes < 60) {
    return `منذ ${arabicPlural(minutes, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `منذ ${arabicPlural(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`
  }

  const days = Math.floor(hours / 24)
  if (days < 30) {
    return `منذ ${arabicPlural(days, 'يوم', 'يومين', 'أيام', 'يوماً')}`
  }

  const months = Math.floor(days / 30)
  return `منذ ${arabicPlural(months, 'شهر', 'شهرين', 'أشهر', 'شهراً')}`
}

/** عدد بأرقام لاتينية (أوضح على الشاشات الصغيرة). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/** «حريق»، «حريقان»، «3 حرائق»… */
export function formatFireCount(count: number): string {
  return arabicPlural(count, 'حريق واحد', 'حريقان', 'حرائق', 'حريقاً')
}

/** «ولاية»، «ولايتان»، «3 ولايات»… */
export function formatWilayaCount(count: number): string {
  return arabicPlural(count, 'ولاية واحدة', 'ولايتان', 'ولايات', 'ولاية')
}
