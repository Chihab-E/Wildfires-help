/**
 * اختبار دالة api/fires.ts نفسها (لا منطق التحويل فقط) باستدعائها
 * كما يستدعيها Vercel، مع استبدال fetch باستجابات FIRMS مُصطنعة.
 *
 * يُحمّل الملف عبر مُحمّل Vite لأنه يفهم TypeScript والاستيراد بلا امتداد،
 * وهو نفس ما يفعله باني Vercel.
 *
 * التشغيل: npm run test:api
 */
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

const server = await createServer({
  logLevel: 'error',
  server: { middlewareMode: true },
})
const { default: handler } = await server.ssrLoadModule('/api/fires.ts')

const MAP_KEY = 'test-key-0000'
const CSV = `country_id,latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
DZA,36.7412,4.4691,331.2,0.42,0.45,2026-08-30,1312,N,VIIRS,n,2.0NRT,295.1,12.4,D
DZA,36.7429,4.4708,340.8,0.42,0.45,2026-08-30,1312,N,VIIRS,h,2.0NRT,298.3,44.9,D
DZA,36.8102,5.6520,318.9,0.51,0.48,2026-08-30,0208,1,VIIRS,l,2.0NRT,288.4,3.1,N`

let failures = 0
function check(label, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : `\n    ${detail}`}`)
}

/** ينفّذ الدالة ويلتقط ما كانت سترسله إلى المتصفح. */
async function invoke({ env = {}, fetchImpl, query = {} } = {}) {
  const savedEnv = { ...process.env }
  const savedFetch = globalThis.fetch

  for (const key of ['FIRMS_MAP_KEY', 'FIRMS_SOURCES', 'FIRMS_DAYS']) delete process.env[key]
  Object.assign(process.env, env)
  if (fetchImpl) globalThis.fetch = fetchImpl

  const captured = { status: 200, headers: {}, body: undefined }
  const res = {
    status(code) {
      captured.status = code
      return res
    },
    setHeader(name, value) {
      captured.headers[name] = value
    },
    json(body) {
      captured.body = body
    },
  }

  try {
    await handler({ query }, res)
  } finally {
    process.env = savedEnv
    globalThis.fetch = savedFetch
  }
  return captured
}

/* ------------------------- إعدادات النشر ------------------------- */
// خطأ في vercel.json يمنع النشر كلياً، وخطأ في قاعدة إعادة الكتابة
// يبتلع /api ويُعيد صفحة HTML بدل JSON — كلاهما يستحق حارساً.
{
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))

  // مخطط Vercel يرفض أي مفتاح غير معروف (بما فيه تعليق «//»)
  const ALLOWED = new Set(['source', 'destination', 'has', 'missing', 'statusCode'])
  const unknown = (config.rewrites ?? []).flatMap((rule) =>
    Object.keys(rule).filter((key) => !ALLOWED.has(key)),
  )
  check('vercel.json: لا مفاتيح خارج مخطط rewrites', unknown.length === 0, unknown.join(', '))

  const pattern = new RegExp(`^${config.rewrites[0].source}$`)
  check('إعادة الكتابة تلتقط مسارات الواجهة', pattern.test('/') && pattern.test('/map'))
  check('إعادة الكتابة لا تبتلع /api', !pattern.test('/api/fires'))
}

/* ---------------------------------------------------------------- */

// 1) بلا مفتاح
{
  const r = await invoke()
  check('بلا مفتاح ← 503 missing_map_key', r.status === 503 && r.body.error === 'missing_map_key',
    JSON.stringify(r.body))
}

// 2) مسار ناجح
{
  const urls = []
  const r = await invoke({
    env: { FIRMS_MAP_KEY: MAP_KEY, FIRMS_SOURCES: 'VIIRS_SNPP_NRT' },
    fetchImpl: async (url) => {
      urls.push(url)
      return new Response(CSV, { status: 200 })
    },
  })
  check('استجابة صالحة ← 200', r.status === 200, JSON.stringify(r.body).slice(0, 200))
  check('يبني رابط FIRMS القُطري للجزائر',
    urls[0] === `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${MAP_KEY}/VIIRS_SNPP_NRT/DZA/1`,
    urls[0])
  check('يدمج النقطتين المتجاورتين في حريق واحد', r.body.fires.length === 2,
    `عدد الحرائق: ${r.body.fires?.length}`)
  check('يعدّ النقاط الخام', r.body.rawDetections === 3, `${r.body.rawDetections}`)
  check('المصدر معلن', r.body.source === 'NASA FIRMS')
  check('كل النقاط غير مؤكدة', r.body.fires.every((f) => f.verified === false))
  check('ترويسة التخزين المؤقت مضبوطة',
    /s-maxage=600/.test(r.headers['Cache-Control'] ?? ''), r.headers['Cache-Control'])
}

// 3) مفتاح غير صالح: FIRMS يردّ 200 بنص عادي
{
  const r = await invoke({
    env: { FIRMS_MAP_KEY: MAP_KEY, FIRMS_SOURCES: 'VIIRS_SNPP_NRT' },
    fetchImpl: async () => new Response('Invalid MAP_KEY.', { status: 200 }),
  })
  check('مفتاح غير صالح ← 502', r.status === 502 && r.body.error === 'upstream_failed',
    JSON.stringify(r.body))
  check('يُظهر سبب FIRMS الحقيقي',
    JSON.stringify(r.body).includes('Invalid MAP_KEY'), JSON.stringify(r.body))
}

// 4) المفتاح لا يتسرّب أبداً في رسائل الخطأ
{
  const r = await invoke({
    env: { FIRMS_MAP_KEY: MAP_KEY, FIRMS_SOURCES: 'VIIRS_SNPP_NRT' },
    fetchImpl: async (url) => new Response(`Error fetching ${url}`, { status: 500 }),
  })
  const serialized = JSON.stringify(r.body)
  check('لا يتسرّب المفتاح في الخطأ', !serialized.includes(MAP_KEY), serialized)
  check('يُخفى المفتاح بـ ***', serialized.includes('***'), serialized)
}

// 5) فشل جزئي: مصدر ينجح وآخر يفشل
{
  const r = await invoke({
    env: { FIRMS_MAP_KEY: MAP_KEY, FIRMS_SOURCES: 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT' },
    fetchImpl: async (url) =>
      url.includes('NOAA20')
        ? new Response('down', { status: 503 })
        : new Response(CSV, { status: 200 }),
  })
  check('فشل جزئي يبقى 200', r.status === 200, `${r.status}`)
  check('يُبلّغ عن المصدر الفاشل',
    r.body.partialFailure?.[0]?.source === 'VIIRS_NOAA20_NRT', JSON.stringify(r.body.partialFailure))
}

// 6) لا حرائق اليوم ليس خطأً
{
  const header = CSV.split('\n')[0]
  const r = await invoke({
    env: { FIRMS_MAP_KEY: MAP_KEY, FIRMS_SOURCES: 'VIIRS_SNPP_NRT' },
    fetchImpl: async () => new Response(header, { status: 200 }),
  })
  check('CSV بلا صفوف ← 200 وقائمة فارغة',
    r.status === 200 && Array.isArray(r.body.fires) && r.body.fires.length === 0,
    JSON.stringify(r.body).slice(0, 200))
}

// 7) FIRMS_DAYS يُحترم ويُقيَّد
{
  const urls = []
  await invoke({
    env: { FIRMS_MAP_KEY: MAP_KEY, FIRMS_SOURCES: 'VIIRS_SNPP_NRT', FIRMS_DAYS: '99' },
    fetchImpl: async (url) => {
      urls.push(url)
      return new Response(CSV, { status: 200 })
    },
  })
  check('FIRMS_DAYS مقيَّد بـ 10', urls[0].endsWith('/DZA/10'), urls[0])
}

console.log(`\n${failures === 0 ? 'كل الاختبارات نجحت' : `${failures} اختبار فشل`}`)
await server.close()
process.exit(failures === 0 ? 0 : 1)
