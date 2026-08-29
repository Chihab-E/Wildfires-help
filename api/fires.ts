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
import { firmsRowsToFires, parseCsv } from './_firms.ts'

const DEFAULT_SOURCES = 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT'
const FETCH_TIMEOUT_MS = 12_000

function jsonResponse(body: unknown, status: number, cacheSeconds: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // التحديث التلقائي: حافة Vercel تعيد الجلب كل `cacheSeconds`
      // وتُقدّم النسخة القديمة أثناء ذلك حتى لا ينتظر أحد.
      'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=1800`,
    },
  })
}

export async function GET(): Promise<Response> {
  const mapKey = process.env.FIRMS_MAP_KEY?.trim()

  if (!mapKey) {
    return jsonResponse(
      {
        error: 'missing_map_key',
        message:
          'لم يُضبط FIRMS_MAP_KEY على الخادم. احصل على مفتاح مجاني من ' +
          'https://firms.modaps.eosdis.nasa.gov/api/map_key/ وأضفه في إعدادات المشروع.',
      },
      503,
      60,
    )
  }

  const sources = (process.env.FIRMS_SOURCES?.trim() || DEFAULT_SOURCES)
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean)

  const days = Math.min(10, Math.max(1, Number(process.env.FIRMS_DAYS ?? 1) || 1))

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${mapKey}/${source}/DZA/${days}`
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`)

      const text = await response.text()
      // عند تجاوز الحصة يردّ FIRMS بنص عادي لا بـ CSV
      if (!text.toLowerCase().startsWith('country_id') && !text.toLowerCase().includes('latitude')) {
        throw new Error(`${source}: استجابة غير متوقعة`)
      }
      return parseCsv(text)
    }),
  )

  const rows = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  const failures = results
    .map((result, index) => (result.status === 'rejected' ? sources[index] : null))
    .filter((source): source is string => source !== null)

  // فشل كل المصادر: نُرجع خطأً بدل إيهام المستخدم بعدم وجود حرائق
  if (rows.length === 0 && failures.length === sources.length) {
    return jsonResponse(
      {
        error: 'upstream_failed',
        message: 'تعذّر جلب البيانات من NASA FIRMS حالياً.',
        failedSources: failures,
      },
      502,
      30,
    )
  }

  const fires = firmsRowsToFires(rows)

  return jsonResponse(
    {
      fires,
      updatedAt: new Date().toISOString(),
      source: 'NASA FIRMS',
      sources,
      days,
      rawDetections: rows.length,
      ...(failures.length > 0 ? { partialFailure: failures } : {}),
    },
    200,
    600,
  )
}
