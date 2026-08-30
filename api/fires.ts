/**
 * دالة Vercel: تجلب نقاط الحريق من NASA FIRMS للجزائر وتعيدها بصيغة التطبيق.
 *
 * لماذا على الخادم وليس في المتصفح؟
 *  1. مفتاح FIRMS (MAP_KEY) يجب ألّا يصل إلى المتصفح.
 *  2. FIRMS لا يرسل ترويسات CORS، فالمتصفح لا يستطيع مناداته مباشرة.
 *  3. التخزين المؤقت على حافة Vercel يحمي حصّة الطلبات (5000/10 دقائق).
 *
 * متغيرات البيئة (على الخادم فقط — ليست VITE_*):
 *   FIRMS_MAP_KEY  مطلوب — مفتاح مجاني من https://firms.modaps.eosdis.nasa.gov/api/map_key/
 *   FIRMS_SOURCES  اختياري — مفصولة بفواصل، الافتراضي: VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT
 *   FIRMS_DAYS     اختياري — عدد الأيام (1..10)، الافتراضي 1
 */
import { firmsRowsToFires, parseCsv } from './_firms'
import { WILAYAS } from '../shared/wilayas'

/**
 * توقيع Node الكلاسيكي `(req, res)` مدعوم على Vercel منذ البداية وفي كل
 * الإعدادات، بخلاف توقيع الويب `export function GET()` الأحدث.
 * الأنواع مكتوبة يدوياً هنا لتجنّب اعتمادية `@vercel/node`.
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

/** نتيجة محاولة جلب مصدر واحد. */
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
  const mapKey = process.env.FIRMS_MAP_KEY?.trim()

  const send = (body: unknown, status: number, cacheSeconds: number): void => {
    // التحديث التلقائي: حافة Vercel تعيد الجلب كل `cacheSeconds`
    // وتُقدّم النسخة القديمة أثناء ذلك حتى لا ينتظر أحد.
    response.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheSeconds}, stale-while-revalidate=1800`,
    )
    response.status(status).json(body)
  }

  if (!mapKey) {
    send(
      {
        error: 'missing_map_key',
        message:
          'لم يُضبط FIRMS_MAP_KEY على الخادم. أضِفه في إعدادات المشروع ثم أعِد النشر.',
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

  const results = await Promise.all(
    sources.map((source) => fetchSource(source, mapKey, days)),
  )

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

  const fires = firmsRowsToFires(rows, WILAYAS)

  send(
    {
      fires,
      updatedAt: new Date().toISOString(),
      source: 'NASA FIRMS',
      sources,
      days,
      rawDetections: rows.length,
      ...(failures.length > 0
        ? { partialFailure: failures.map((f) => ({ source: f.source, error: f.error })) }
        : {}),
      // ?debug=1 يكشف ما الذي وصل فعلاً من كل مصدر
      ...(request.query?.debug
        ? { debug: results.map((r) => ({ source: r.source, rows: r.rows.length, error: r.error })) }
        : {}),
    },
    200,
    600,
  )
}
