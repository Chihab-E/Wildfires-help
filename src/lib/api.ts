import { config, hasLiveApi } from './config'
import { buildDemoFires } from '../data/demoFires'
import { nearestWilaya } from '../data/wilayas'
import type { Fire, FireStatus, FiresPayload, Severity, SourceKind } from '../types'

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

/**
 * حزمة البيانات التجريبية مع سبب اللجوء إليها.
 * `diagnostic` نص تقني لمن ينشر الموقع، يُعرض مطوياً في الواجهة
 * حتى لا يُضطر أحد لفتح ‎/api/fires‎ يدوياً لمعرفة سبب العطل.
 */
function demoPayload(notice?: string, diagnostic?: string): FiresPayload {
  return {
    fires: buildDemoFires(),
    updatedAt: new Date().toISOString(),
    isDemo: true,
    sourceLabel: 'بيانات تجريبية',
    notice,
    diagnostic,
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
    return demoPayload('لا يوجد مصدر بيانات مباشر مفعّل.')
  }

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (config.firesApiAuth) headers.Authorization = config.firesApiAuth

  let payload: unknown
  try {
    const response = await fetch(config.firesApiUrl, { headers, signal: combined })
    const text = await response.text()

    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }

    const serverMessage =
      typeof payload === 'object' && payload !== null
        ? toText((payload as Record<string, unknown>).message)
        : ''

    if (!response.ok) {
      return demoPayload(
        'تعذّر تحميل بيانات الحرائق المباشرة الآن.',
        `HTTP ${response.status} — ${serverMessage || text.slice(0, 300)}`,
      )
    }

    /*
     * ردّ ناجح لكنه ليس JSON = العنوان لا يصل إلى الدالة أصلاً
     * (قاعدة إعادة كتابة تبتلع ‎/api‎ فتُعيد صفحة HTML بحالة 200).
     * بدون هذا الفحص كان التطبيق يعرض «صفر حرائق» بلا أي تحذير،
     * وهو أسوأ فشل ممكن هنا: عطل يبدو كأنه «لا توجد حرائق».
     */
    if (typeof payload !== 'object' || payload === null) {
      const contentType = response.headers.get('content-type') ?? 'غير معروف'
      return demoPayload(
        'مصدر البيانات المباشر لا يستجيب بشكل صحيح.',
        `الرد ليس JSON (content-type: ${contentType}) — ${text.slice(0, 300)}`,
      )
    }
  } catch (error) {
    if (signal?.aborted) throw error
    return demoPayload(
      'لا يوجد اتصال بمصدر البيانات المباشر.',
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    )
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
