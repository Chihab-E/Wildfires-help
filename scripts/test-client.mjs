/**
 * اختبار طبقة جلب البيانات في الواجهة (src/lib/api.ts).
 *
 * أهم ما يغطّيه: التمييز بين «لا توجد حرائق» و«المصدر معطّل».
 * الخلط بينهما هو أخطر فشل ممكن في هذا التطبيق، لأن العطل يظهر
 * للمستخدم كأنه طمأنة بأن لا حرائق.
 *
 * التشغيل: npm run test:client
 */
import { createServer } from 'vite'

const server = await createServer({ logLevel: 'error', server: { middlewareMode: true } })
const { fetchFires } = await server.ssrLoadModule('/src/lib/api.ts')

let failures = 0
function check(label, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : `\n    ${detail}`}`)
}

/** يشغّل fetchFires مقابل استجابة مُصطنعة. */
async function withResponse(response) {
  const saved = globalThis.fetch
  globalThis.fetch = async () => response
  try {
    return await fetchFires()
  } finally {
    globalThis.fetch = saved
  }
}

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })

/* ---------- المسار الناجح ---------- */
{
  const payload = await withResponse(
    json({
      source: 'NASA FIRMS',
      updatedAt: '2026-08-30T10:00:00Z',
      fires: [
        {
          id: 'f1',
          lat: 36.8102,
          lon: 5.652,
          severity: 'critical',
          status: 'active',
          reportedAt: '2026-08-30T09:00:00Z',
          sourceKind: 'satellite',
          verified: false,
          detectionCount: 4,
        },
      ],
    }),
  )
  check('استجابة صالحة ← ليست تجريبية', payload.isDemo === false, JSON.stringify(payload).slice(0, 160))
  check('يقرأ اسم المصدر', payload.sourceLabel === 'NASA FIRMS', payload.sourceLabel)
  check('يحوّل الحريق', payload.fires.length === 1)
  check('يستنتج الولاية من الإحداثيات', payload.fires[0].wilaya === 'جيجل', payload.fires[0].wilaya)
  check('يحافظ على «غير مؤكد»', payload.fires[0].verified === false)
  check('يمرّر عدد النقاط الحرارية', payload.fires[0].detectionCount === 4)
}

/* ---------- قائمة فارغة حقيقية: ليست عطلاً ---------- */
{
  const payload = await withResponse(json({ source: 'NASA FIRMS', fires: [] }))
  check('قائمة فارغة تبقى «مباشرة» لا تجريبية', payload.isDemo === false)
  check('قائمة فارغة بلا حرائق', payload.fires.length === 0)
}

/* ---------- 200 لكن HTML: العطل الصامت ---------- */
{
  // هذا ما يحدث حين تبتلع قاعدة إعادة الكتابة /api وتُعيد صفحة التطبيق.
  // كان التطبيق سابقاً يعرض «صفر حرائق» بلا تحذير — عطل يبدو كطمأنة.
  const payload = await withResponse(
    new Response('<!doctype html><html><body>app</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }),
  )
  check('HTML بحالة 200 يُعتبر عطلاً لا «صفر حرائق»', payload.isDemo === true, payload.sourceLabel)
  check('يشرح أن الرد ليس JSON', (payload.diagnostic ?? '').includes('ليس JSON'), payload.diagnostic)
  check('يذكر نوع المحتوى', (payload.diagnostic ?? '').includes('text/html'), payload.diagnostic)
}

/* ---------- أخطاء الخادم ---------- */
{
  const payload = await withResponse(
    json({ error: 'missing_map_key', message: 'لم يُضبط FIRMS_MAP_KEY على الخادم.' }, { status: 503 }),
  )
  check('503 ← بيانات تجريبية', payload.isDemo === true)
  check('يُبقي رسالة الخادم في التشخيص',
    (payload.diagnostic ?? '').includes('FIRMS_MAP_KEY'), payload.diagnostic)
  check('يذكر رمز الحالة', (payload.diagnostic ?? '').includes('503'), payload.diagnostic)
}

/* ---------- انقطاع الشبكة ---------- */
{
  const saved = globalThis.fetch
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch')
  }
  const payload = await fetchFires().finally(() => {
    globalThis.fetch = saved
  })
  check('فشل الشبكة ← بيانات تجريبية', payload.isDemo === true)
  check('يسجّل سبب الفشل', (payload.diagnostic ?? '').includes('Failed to fetch'), payload.diagnostic)
}

/* ---------- البيانات التجريبية موسومة دائماً ---------- */
{
  const payload = await withResponse(new Response('boom', { status: 500 }))
  check('التجريبي موسوم بوضوح', payload.sourceLabel === 'بيانات تجريبية', payload.sourceLabel)
  check('لا حريق تجريبي يُعرض كمؤكد رسمي',
    payload.fires.every((fire) => fire.sourceKind !== 'official' || fire.sourceName.includes('تجريبي')))
}

console.log(`\n${failures === 0 ? 'كل الاختبارات نجحت' : `${failures} اختبار فشل`}`)
await server.close()
process.exit(failures === 0 ? 0 : 1)
