import { config, hasLiveApi, hasReportEndpoint } from './config'
import { buildDemoFires } from '../data/demoFires'
import { nearestWilaya } from '../data/wilayas'
import type { Fire, FireReport, FireStatus, FiresPayload, Severity, SourceKind } from '../types'

/**
 * طبقة البيانات الوحيدة في التطبيق.
 *
 * لربط مصدر حقيقي لاحقاً: اضبط `VITE_FIRES_API_URL` على عنوان يُعيد إحدى الصيغ الثلاث:
 *   1) مصفوفة كائنات        →  [ { ... }, ... ]
 *   2) كائن يحوي المصفوفة   →  { "fires": [...], "updatedAt": "..." }
 *   3) GeoJSON              →  { "type": "FeatureCollection", "features": [...] }
 *
 * أسماء الحقول مرنة: يقبل المُحوِّل أدناه المرادفات الشائعة
 * (latitude/lat، acq_date/reportedAt، confidence...) بما يشمل مخرجات
 * NASA FIRMS بعد تحويلها إلى JSON، لذلك يكفي غالباً وضع وسيط بسيط
 * (Vercel Function) يمرّر البيانات كما هي.
 */

/* ------------------------------- أدوات مساعدة ------------------------------ */

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function toNumber(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : undefined
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
}

function toIso(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') {
    // ثوانٍ أو ميلي‑ثانية
    const ms = value < 1e12 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  const raw = String(value).trim()
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  // صيغة FIRMS: acq_date="2026-08-29" + acq_time="1435"
  return undefined
}

function normalizeSeverity(raw: unknown, confidence?: number): Severity {
  const text = toText(raw).toLowerCase()
  if (['critical', 'حرج', 'كارثي', 'red', 'extreme'].includes(text)) return 'critical'
  if (['serious', 'severe', 'high', 'خطير', 'كبير'].includes(text)) return 'serious'
  if (['moderate', 'medium', 'low', 'nominal', 'متوسط', 'محدود'].includes(text)) return 'moderate'

  // بدون حقل صريح: نستنتج من ثقة الرصد الفضائي
  if (confidence !== undefined) {
    if (confidence >= 80) return 'critical'
    if (confidence >= 55) return 'serious'
  }
  return 'moderate'
}

function normalizeStatus(raw: unknown): FireStatus {
  const text = toText(raw).toLowerCase()
  if (['extinguished', 'out', 'closed', 'مطفأ', 'أُخمد', 'اخمد', 'منتهٍ'].includes(text)) {
    return 'extinguished'
  }
  if (['contained', 'controlled', 'محاصر', 'تحت السيطرة'].includes(text)) return 'contained'
  return 'active'
}

function normalizeSourceKind(raw: unknown): SourceKind {
  const text = toText(raw).toLowerCase()
  if (['satellite', 'firms', 'viirs', 'modis', 'رصد فضائي', 'قمر'].includes(text)) return 'satellite'
  if (['report', 'user', 'citizen', 'بلاغ', 'مستخدم'].includes(text)) return 'report'
  return 'official'
}

/* ------------------------------- تحويل السجل ------------------------------ */

let fallbackId = 0

/** يحوّل سجلاً خام (أياً كانت تسمية حقوله) إلى `Fire`، أو `null` إن تعذّر. */
export function normalizeFire(input: unknown): Fire | null {
  if (typeof input !== 'object' || input === null) return null

  let raw = input as Record<string, unknown>
  let lat: number | undefined
  let lon: number | undefined

  // GeoJSON Feature
  const geometry = raw.geometry as Record<string, unknown> | undefined
  if (raw.type === 'Feature' && geometry && Array.isArray(geometry.coordinates)) {
    const coords = geometry.coordinates as unknown[]
    lon = toNumber(coords[0])
    lat = toNumber(coords[1])
    raw = { ...(raw.properties as Record<string, unknown> | undefined), id: raw.id }
  }

  lat ??= toNumber(pick(raw, ['lat', 'latitude', 'Latitude', 'y']))
  lon ??= toNumber(pick(raw, ['lon', 'lng', 'long', 'longitude', 'Longitude', 'x']))
  if (lat === undefined || lon === undefined) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null

  const confidence = toNumber(pick(raw, ['confidence', 'conf', 'ثقة']))
  const sourceKind = normalizeSourceKind(
    pick(raw, ['sourceKind', 'source_kind', 'kind', 'type', 'instrument', 'satellite']),
  )

  // التاريخ: حقل واحد، أو صيغة FIRMS المفصولة
  let reportedAt = toIso(
    pick(raw, ['reportedAt', 'reported_at', 'date', 'datetime', 'timestamp', 'time', 'acq_datetime']),
  )
  if (!reportedAt) {
    const acqDate = toText(raw.acq_date)
    const acqTime = toText(raw.acq_time).padStart(4, '0')
    if (acqDate) {
      const iso = `${acqDate}T${acqTime.slice(0, 2)}:${acqTime.slice(2, 4)}:00Z`
      reportedAt = toIso(iso)
    }
  }
  reportedAt ??= new Date().toISOString()

  const wilayaName = toText(pick(raw, ['wilaya', 'province', 'state', 'region']))
  const nearest = nearestWilaya(lat, lon)

  const explicitVerified = pick(raw, ['verified', 'confirmed', 'مؤكد'])
  const verified =
    explicitVerified === undefined
      ? sourceKind === 'official'
      : explicitVerified === true || toText(explicitVerified).toLowerCase() === 'true'

  return {
    id: toText(pick(raw, ['id', 'ID', 'uuid', 'key'])) || `fire-${++fallbackId}`,
    lat,
    lon,
    wilayaCode: toText(pick(raw, ['wilayaCode', 'wilaya_code', 'code'])) || nearest.code,
    wilaya: wilayaName || nearest.name,
    commune: toText(pick(raw, ['commune', 'city', 'town', 'locality'])) || 'غير محددة',
    severity: normalizeSeverity(pick(raw, ['severity', 'level', 'شدة']), confidence),
    status: normalizeStatus(pick(raw, ['status', 'state', 'حالة'])),
    reportedAt,
    updatedAt: toIso(pick(raw, ['updatedAt', 'updated_at', 'lastUpdate'])),
    sourceKind,
    sourceName:
      toText(pick(raw, ['sourceName', 'source_name', 'source', 'provider'])) ||
      (sourceKind === 'satellite'
        ? 'رصد فضائي'
        : sourceKind === 'report'
          ? 'بلاغ مستخدم'
          : 'مصدر رسمي'),
    sourceUrl: toText(pick(raw, ['sourceUrl', 'source_url', 'url', 'link'])) || undefined,
    verified,
    confidence,
    detectionCount: toNumber(pick(raw, ['detectionCount', 'detection_count'])),
    notes: toText(pick(raw, ['notes', 'description', 'details', 'وصف'])) || undefined,
  }
}

/** يستخرج مصفوفة السجلات من أي من الصيغ المدعومة. */
function extractRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as Record<string, unknown>
    for (const key of ['features', 'fires', 'data', 'results', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return []
}

/* --------------------------------- الجلب --------------------------------- */

const REQUEST_TIMEOUT_MS = 15_000

/** حزمة البيانات التجريبية مع سبب اللجوء إليها. */
function demoPayload(notice?: string): FiresPayload {
  return {
    fires: buildDemoFires(),
    updatedAt: new Date().toISOString(),
    isDemo: true,
    sourceLabel: 'بيانات تجريبية',
    notice,
  }
}

/**
 * يجلب الحرائق من الـ API المضبوط.
 *
 * التطبيق قد يُفتح في ظرف طارئ، فلا نتركه فارغاً عند فشل المصدر:
 * نعود إلى البيانات التجريبية مع رسالة صريحة تشرح ما حدث،
 * ويبقى العلم `isDemo` مرفوعاً فلا يختلط التجريبي بالحقيقي أبداً.
 */
export async function fetchFires(signal?: AbortSignal): Promise<FiresPayload> {
  if (!hasLiveApi) {
    return demoPayload('لم يُضبط مصدر بيانات مباشر.')
  }

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (config.firesApiAuth) headers.Authorization = config.firesApiAuth

  let payload: unknown
  try {
    const response = await fetch(config.firesApiUrl, { headers, signal: combined })
    payload = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        (typeof payload === 'object' &&
          payload !== null &&
          toText((payload as Record<string, unknown>).message)) ||
        `رمز ${response.status}`
      return demoPayload(`تعذّر جلب البيانات المباشرة (${message}).`)
    }
  } catch (error) {
    if (signal?.aborted) throw error
    return demoPayload('تعذّر الاتصال بمصدر البيانات المباشر.')
  }

  const fires = extractRecords(payload)
    .map(normalizeFire)
    .filter((fire): fire is Fire => fire !== null)

  const record = typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)
    : {}

  const sourceName = toText(record.source)

  return {
    fires,
    updatedAt: toIso(record.updatedAt) ?? new Date().toISOString(),
    isDemo: false,
    sourceLabel: sourceName || 'مصدر مباشر',
  }
}

/* -------------------------------- البلاغات -------------------------------- */

export type ReportOutcome =
  | { ok: true; queued: false }
  /** لا توجد نقطة نهاية مضبوطة، أو فشل الإرسال: حُفظ البلاغ محلياً */
  | { ok: true; queued: true; reason: 'no-endpoint' | 'offline' }
  | { ok: false; error: string }

const QUEUE_KEY = 'wildfires:pending-reports'

function readQueue(): FireReport[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as FireReport[]) : []
  } catch {
    return []
  }
}

function writeQueue(reports: FireReport[]): void {
  try {
    // نحتفظ بآخر 20 بلاغاً فقط حتى لا نملأ مساحة التخزين
    localStorage.setItem(QUEUE_KEY, JSON.stringify(reports.slice(-20)))
  } catch {
    /* التخزين ممتلئ أو معطّل — نتجاهل */
  }
}

export function pendingReportsCount(): number {
  return readQueue().length
}

function queueReport(report: FireReport): void {
  writeQueue([...readQueue(), report])
}

type PostResult = { ok: true } | { ok: false; retryable: boolean; error: string }

/** إرسال خام بدون أي حفظ محلي. */
async function postReport(report: FireReport): Promise<PostResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.reportEndpointAuth) headers.Authorization = config.reportEndpointAuth

  try {
    const response = await fetch(config.reportEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      return {
        ok: false,
        // أخطاء الخادم (5xx) قد تنجح لاحقاً، أما 4xx فالبلاغ نفسه مرفوض
        retryable: response.status >= 500,
        error: `رفض الخادم البلاغ (رمز ${response.status})`,
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, retryable: true, error: 'تعذّر الاتصال بالخادم' }
  }
}

/**
 * يرسل البلاغ إلى نقطة النهاية المضبوطة.
 * أي خدمة تقبل `POST application/json` تصلح:
 * Vercel Function، Cloudflare Worker، Formspree، Google Apps Script، n8n…
 */
export async function submitReport(report: FireReport): Promise<ReportOutcome> {
  if (!hasReportEndpoint) {
    queueReport(report)
    return { ok: true, queued: true, reason: 'no-endpoint' }
  }

  const result = await postReport(report)
  if (result.ok) return { ok: true, queued: false }

  if (result.retryable) {
    queueReport(report)
    return { ok: true, queued: true, reason: 'offline' }
  }
  return { ok: false, error: result.error }
}

/** يحاول إرسال البلاغات المحفوظة محلياً. يُعيد عدد ما نجح إرساله. */
export async function flushQueuedReports(): Promise<number> {
  if (!hasReportEndpoint) return 0

  const queue = readQueue()
  if (queue.length === 0) return 0

  const remaining: FireReport[] = []
  let sent = 0

  for (const report of queue) {
    const result = await postReport(report)
    if (result.ok) sent++
    else if (result.retryable) remaining.push(report)
    // البلاغات المرفوضة نهائياً (4xx) تُسقط حتى لا تعلق في الطابور
  }

  writeQueue(remaining)
  return sent
}
