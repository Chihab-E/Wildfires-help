/**
 * دالة Vercel: تجلب نقاط الحريق من NASA FIRMS للجزائر وتعيدها بصيغة التطبيق.
 *
 * لماذا على الخادم وليس في المتصفح؟
 *  1. مفتاح FIRMS (MAP_KEY) يجب ألّا يصل إلى المتصفح.
 *  2. FIRMS لا يرسل ترويسات CORS، فالمتصفح لا يستطيع مناداته مباشرة.
 *  3. التخزين المؤقت على حافة Vercel يحمي حصّة الطلبات (5000/10 دقائق).
 *
 * ⚠️ هذا الملف مكتفٍ بذاته عمداً: لا استيراد نسبي فيه إطلاقاً.
 * المشروع ESM (‎"type": "module"‎)، وVercel يترجم TypeScript ولا يحزمه،
 * فأي استيراد نسبي بلا امتداد ‎.js‎ ينهار وقت التشغيل بـ ERR_MODULE_NOT_FOUND
 * ويظهر كـ FUNCTION_INVOCATION_FAILED. الاكتفاء الذاتي يُنهي هذا الخطر كلّه.
 *
 * الدوال الخالصة مُصدَّرة للاختبار (scripts/test-firms.mjs)؛
 * Vercel يتجاهل أي تصدير غير الافتراضي.
 *
 * متغيرات البيئة (على الخادم فقط — ليست VITE_*):
 *   FIRMS_MAP_KEY  مطلوب — مفتاح مجاني من https://firms.modaps.eosdis.nasa.gov/api/map_key/
 *   FIRMS_SOURCES  اختياري — مفصولة بفواصل، الافتراضي: VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT
 *   FIRMS_DAYS     اختياري — عدد الأيام (1..10)، الافتراضي 1
 */

/* ================================ الأنواع ================================ */

export type Severity = 'moderate' | 'serious' | 'critical'

export interface FirmsFire {
  id: string
  lat: number
  lon: number
  severity: Severity
  status: 'active'
  reportedAt: string
  sourceKind: 'satellite'
  sourceName: string
  sourceUrl: string
  verified: false
  confidence?: number
  /** كم نقطة حرارية اندمجت في هذا التجمّع */
  detectionCount: number
  notes: string
}

/* ============================== تحليل CSV =============================== */

/** محلّل CSV بسيط يكفي لمخرجات FIRMS (لا حقول تحوي فواصل أو اقتباسات). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((header) => header.trim())
  const rows: Record<string, string>[] = []

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

/* ============================= حقول FIRMS ============================== */

/**
 * الثقة: VIIRS يستخدم حروفاً (l/n/h) بينما MODIS يستخدم نسبة 0–100.
 * نوحّدها إلى نسبة مئوية تقريبية.
 */
export function parseConfidence(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const text = raw.trim().toLowerCase()

  if (text === 'l' || text === 'low') return 20
  if (text === 'n' || text === 'nominal') return 60
  if (text === 'h' || text === 'high') return 90

  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : undefined
}

/**
 * الشدة تُقدَّر من FRP (Fire Radiative Power بالميغاواط) — وهو أفضل مؤشر
 * متاح على حجم الاحتراق. الثقة وحدها لا تدل على الشدة، إنما على صحة الرصد.
 * العتبات اجتهادية ومصرّح بها في الواجهة كتقدير آلي.
 */
export function severityFromFrp(frp: number | undefined): Severity {
  if (frp === undefined) return 'moderate'
  if (frp >= 50) return 'critical'
  if (frp >= 15) return 'serious'
  return 'moderate'
}

/** `acq_date`=2026-08-30 + `acq_time`=1435 (UTC) → ISO 8601 */
export function parseAcquisition(
  date: string | undefined,
  time: string | undefined,
): string | null {
  if (!date) return null
  const padded = (time ?? '0000').padStart(4, '0')
  const iso = `${date}T${padded.slice(0, 2)}:${padded.slice(2, 4)}:00Z`
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** الحدود التقريبية للجزائر — لاستبعاد أي نقطة خارجها. */
export const ALGERIA_BBOX = { west: -8.7, south: 18.9, east: 12.0, north: 37.4 }

export function inAlgeria(lat: number, lon: number): boolean {
  return (
    lat >= ALGERIA_BBOX.south &&
    lat <= ALGERIA_BBOX.north &&
    lon >= ALGERIA_BBOX.west &&
    lon <= ALGERIA_BBOX.east
  )
}

/* =============================== التجميع =============================== */

export interface Point {
  lat: number
  lon: number
  frp: number
  confidence?: number
  time: string
  satellite: string
}

/**
 * حريق واحد يظهر في FIRMS كعشرات البكسلات المتجاورة (بكسل VIIRS ≈ 375 م).
 * بدون دمجها يصبح العدّاد مضلّلاً («347 حريقاً» بدل «12»).
 *
 * نستعمل تجميعاً بالمسافة الحقيقية لا بشبكة ثابتة: الشبكة الثابتة تفصل
 * نقطتين متجاورتين لمجرد مرور حدّ خلية بينهما، فينقسم الحريق الواحد.
 * الشبكة هنا تُستخدم فقط كفهرس مكاني يسرّع البحث.
 */
const CLUSTER_RADIUS_KM = 2
const KM_PER_DEGREE = 111.32

function distanceKm(a: Point, b: Point): number {
  const dLat = (a.lat - b.lat) * KM_PER_DEGREE
  const meanLat = (((a.lat + b.lat) / 2) * Math.PI) / 180
  const dLon = (a.lon - b.lon) * KM_PER_DEGREE * Math.cos(meanLat)
  return Math.hypot(dLat, dLon)
}

export function clusterPoints(points: Point[]): Point[][] {
  const cellSize = CLUSTER_RADIUS_KM / KM_PER_DEGREE
  /** مفتاح الخلية → فهارس التجمّعات التي يقع ممثلها فيها */
  const index = new Map<string, number[]>()
  const clusters: Point[][] = []
  const seeds: Point[] = []

  for (const point of points) {
    const cellLat = Math.floor(point.lat / cellSize)
    const cellLon = Math.floor(point.lon / cellSize)

    // يكفي فحص الخلايا التسع المجاورة لأن نصف القطر = حجم الخلية
    let target = -1
    search: for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const candidate of index.get(`${cellLat + dy}:${cellLon + dx}`) ?? []) {
          if (distanceKm(point, seeds[candidate]) <= CLUSTER_RADIUS_KM) {
            target = candidate
            break search
          }
        }
      }
    }

    if (target >= 0) {
      clusters[target].push(point)
      continue
    }

    const created = clusters.length
    clusters.push([point])
    seeds.push(point)

    const key = `${cellLat}:${cellLon}`
    const bucket = index.get(key)
    if (bucket) bucket.push(created)
    else index.set(key, [created])
  }

  return clusters
}

/* =============================== التحويل =============================== */

/**
 * يحوّل صفوف CSV الخام إلى قائمة حرائق مجمّعة.
 *
 * لا يُسنِد ولاية ولا بلدية عمداً: الواجهة تستنتج الولاية من الإحداثيات
 * أصلاً (`normalizeFire` في src/lib/api.ts)، فلا داعي لحمل جدول الولايات
 * إلى الخادم — وهذا ما يُبقي هذا الملف بلا اعتماديات.
 */
export function firmsRowsToFires(rows: Record<string, string>[]): FirmsFire[] {
  const points: Point[] = []

  for (const row of rows) {
    const lat = Number(row.latitude)
    const lon = Number(row.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (!inAlgeria(lat, lon)) continue

    const time = parseAcquisition(row.acq_date, row.acq_time)
    if (!time) continue

    const frp = Number(row.frp)
    points.push({
      lat,
      lon,
      frp: Number.isFinite(frp) ? frp : 0,
      confidence: parseConfidence(row.confidence),
      time,
      satellite: row.satellite || row.instrument || 'VIIRS',
    })
  }

  return clusterPoints(points).map((group) => {
    // النقطة الأقوى تمثّل التجمّع، ومجموع FRP يعبّر عن حجمه الكلي
    const strongest = group.reduce((a, b) => (b.frp > a.frp ? b : a))
    const totalFrp = group.reduce((sum, point) => sum + point.frp, 0)
    const latest = group.reduce((a, b) => (b.time > a.time ? b : a))

    const lat = Number(strongest.lat.toFixed(5))
    const lon = Number(strongest.lon.toFixed(5))

    const confidences = group
      .map((point) => point.confidence)
      .filter((value): value is number => value !== undefined)
    const confidence = confidences.length > 0 ? Math.round(Math.max(...confidences)) : undefined

    return {
      id: `firms-${lat.toFixed(4)}-${lon.toFixed(4)}-${latest.time}`,
      lat,
      lon,
      severity: severityFromFrp(totalFrp),
      status: 'active' as const,
      reportedAt: latest.time,
      sourceKind: 'satellite' as const,
      sourceName: `NASA FIRMS · ${strongest.satellite}`,
      sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/map/',
      verified: false as const,
      confidence,
      detectionCount: group.length,
      notes:
        'نقطة حرارية رصدها قمر صناعي في هذا التوقيت. ' +
        'قد لا تكون حريقاً مستمراً الآن، وقد تكون مصدر حرارة آخر مثل حرق المحاصيل. ' +
        'الولاية مُقدَّرة من الإحداثيات، والبلدية غير متوفرة من هذا المصدر.',
    }
  })
}

/* =============================== الدالة ================================ */

/**
 * توقيع Node الكلاسيكي `(req, res)` مدعوم على Vercel منذ البداية وفي كل
 * الإعدادات، بخلاف توقيع الويب `export function GET()` الأحدث.
 * الأنواع مكتوبة يدوياً لتجنّب اعتمادية `@vercel/node`.
 */
interface ApiRequest {
  query?: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  status(code: number): ApiResponse
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

const DEFAULT_SOURCES = 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT'
const FETCH_TIMEOUT_MS = 12_000

interface SourceResult {
  source: string
  rows: Record<string, string>[]
  error?: string
}

/**
 * يمنع تسرّب المفتاح إلى أي رسالة خطأ تُعاد للمتصفح.
 * رسائل FIRMS قد تتضمّن الرابط كاملاً بما فيه المفتاح.
 */
function redact(text: string, mapKey: string): string {
  return text.split(mapKey).join('***')
}

async function fetchSource(source: string, mapKey: string, days: number): Promise<SourceResult> {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${mapKey}/${source}/DZA/${days}`

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    const text = await response.text()

    if (!response.ok) {
      return {
        source,
        rows: [],
        error: `HTTP ${response.status}: ${redact(text.slice(0, 160), mapKey)}`,
      }
    }

    // FIRMS يردّ بنص عادي (لا CSV) عند مفتاح غير صالح أو تجاوز الحصة،
    // ونصّه يشرح السبب بدقة فنُعيده كما هو بعد إخفاء المفتاح.
    const head = text.slice(0, 200).toLowerCase()
    if (!head.includes('latitude') || !head.includes('longitude')) {
      return {
        source,
        rows: [],
        error: `استجابة غير متوقعة: ${redact(text.slice(0, 160).trim(), mapKey)}`,
      }
    }

    return { source, rows: parseCsv(text) }
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error'
    const message = error instanceof Error ? error.message : String(error)
    return { source, rows: [], error: `${name}: ${redact(message, mapKey)}` }
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const send = (body: unknown, status: number, cacheSeconds: number): void => {
    // التحديث التلقائي: حافة Vercel تعيد الجلب كل `cacheSeconds`
    // وتُقدّم النسخة القديمة أثناء ذلك حتى لا ينتظر أحد.
    response.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheSeconds}, stale-while-revalidate=1800`,
    )
    response.status(status).json(body)
  }

  const mapKey = process.env.FIRMS_MAP_KEY?.trim()

  if (!mapKey) {
    send(
      {
        error: 'missing_map_key',
        message: 'لم يُضبط FIRMS_MAP_KEY على الخادم. أضِفه في إعدادات المشروع ثم أعِد النشر.',
        hint: 'Vercel → Settings → Environment Variables → FIRMS_MAP_KEY, then redeploy.',
      },
      503,
      60,
    )
    return
  }

  const sources = (process.env.FIRMS_SOURCES?.trim() || DEFAULT_SOURCES)
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean)

  const days = Math.min(10, Math.max(1, Number(process.env.FIRMS_DAYS ?? 1) || 1))

  const results = await Promise.all(sources.map((source) => fetchSource(source, mapKey, days)))

  const rows = results.flatMap((result) => result.rows)
  const failures = results.filter((result) => result.error)

  // فشل كل المصادر: نُرجع خطأً بدل إيهام المستخدم بعدم وجود حرائق
  if (failures.length === sources.length) {
    send(
      {
        error: 'upstream_failed',
        message: 'تعذّر جلب البيانات من NASA FIRMS حالياً.',
        failures: failures.map((failure) => ({ source: failure.source, error: failure.error })),
      },
      502,
      30,
    )
    return
  }

  send(
    {
      fires: firmsRowsToFires(rows),
      updatedAt: new Date().toISOString(),
      source: 'NASA FIRMS',
      sources,
      days,
      rawDetections: rows.length,
      ...(failures.length > 0
        ? {
            partialFailure: failures.map((failure) => ({
              source: failure.source,
              error: failure.error,
            })),
          }
        : {}),
      // ?debug=1 يكشف ما الذي وصل فعلاً من كل مصدر
      ...(request.query?.debug
        ? {
            debug: results.map((result) => ({
              source: result.source,
              rows: result.rows.length,
              error: result.error,
            })),
          }
        : {}),
    },
    200,
    600,
  )
}
