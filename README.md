# 🔥 حرائق الجزائر — Wildfires Help

تطبيق ويب خفيف (PWA) لتتبع حرائق الغابات في الجزائر: خريطة تفاعلية، إبلاغ عن حريق،
وأرقام الطوارئ الوطنية. عربي بالكامل مع دعم RTL، مصمّم للهاتف أولاً.

> ⚠️ **تنبيه مهم:** لا يحتوي المشروع على أي بيانات حرائق حقيقية. ما لم تُضبط
> `VITE_FIRES_API_URL` فإن التطبيق يعرض **بيانات تجريبية موسومة بوضوح** في الواجهة.

---

## التقنيات

| | |
|---|---|
| الواجهة | React 19 + TypeScript + Vite |
| التنسيق | Tailwind CSS v4 |
| الخريطة | Leaflet + Leaflet.markercluster |
| PWA | `vite-plugin-pwa` (Workbox) |
| الخلفية | لا يوجد — واجهة أمامية فقط |
| النشر | Vercel (أو أي استضافة ملفات ثابتة) |

## التشغيل محلياً

```bash
npm install
npm run dev      # خادم التطوير
npm run build    # حزمة الإنتاج في dist/
npm run preview  # معاينة حزمة الإنتاج
npm run icons    # إعادة توليد أيقونات PWA
```

---

## متغيرات البيئة

**كلها اختيارية.** بدونها يعمل التطبيق كاملاً ببيانات تجريبية.
انسخ `.env.example` إلى `.env.local`، أو اضبطها في
Vercel → Settings → Environment Variables.

| المتغير | الوصف | الافتراضي |
|---|---|---|
| `VITE_FIRES_API_URL` | عنوان JSON يُعيد الحرائق. فارغ ⇒ بيانات تجريبية | — |
| `VITE_FIRES_API_AUTH` | ترويسة `Authorization` للمصدر أعلاه (مثل `Bearer xxx`) | — |
| `VITE_REPORT_ENDPOINT` | عنوان يستقبل بلاغات المستخدمين عبر `POST JSON` | — |
| `VITE_REPORT_ENDPOINT_AUTH` | ترويسة `Authorization` لنقطة البلاغات | — |
| `VITE_MAP_TILE_URL` | قالب بلاط الخريطة | OpenStreetMap |
| `VITE_MAP_TILE_ATTRIBUTION` | نص إسناد البلاط | OpenStreetMap |
| `VITE_REFRESH_MINUTES` | إعادة الجلب التلقائي بالدقائق (`0` = تعطيل) | `10` |
| `VITE_RECENT_HOURS` | نافذة مرشّح «حديث» بالساعات | `24` |

> ⚠️ متغيرات `VITE_*` تُحزَم داخل ملفات JavaScript العلنية. **لا تضع فيها مفاتيح سرية.**
> إن كان مصدر البيانات يحتاج مفتاحاً، ضع وسيطاً (Vercel Function) يحتفظ بالمفتاح على
> الخادم ووجّه `VITE_FIRES_API_URL` إليه.

---

## ربط مصدر بيانات حقيقي

اضبط `VITE_FIRES_API_URL` على عنوان يُعيد أياً من هذه الصيغ:

```jsonc
// 1) مصفوفة مباشرة
[ { "lat": 36.75, "lon": 5.08, "wilaya": "بجاية", ... } ]

// 2) كائن يحوي المصفوفة
{ "updatedAt": "2026-08-29T05:00:00Z", "fires": [ ... ] }

// 3) GeoJSON
{ "type": "FeatureCollection", "features": [ ... ] }
```

المحوّل في `src/lib/api.ts` مرن مع أسماء الحقول ويقبل المرادفات الشائعة:

| الحقل | المرادفات المقبولة |
|---|---|
| الإحداثيات | `lat`/`latitude`/`y` · `lon`/`lng`/`longitude`/`x` · أو `geometry.coordinates` |
| الوقت | `reportedAt`/`date`/`timestamp` · أو `acq_date` + `acq_time` (صيغة NASA FIRMS) |
| الشدة | `severity`/`level` — وإن غابت تُستنتج من `confidence` |
| الحالة | `status`/`state` (`active` / `contained` / `extinguished`) |
| نوع المصدر | `sourceKind`/`instrument`/`satellite` (`satellite` / `official` / `report`) |
| التأكيد | `verified`/`confirmed` — وإن غاب فالمصادر الرسمية فقط تُعتبر مؤكدة |

### مثال: ربط NASA FIRMS عبر دالة Vercel

`FIRMS` يُعيد CSV ويتطلب مفتاحاً، فالوسيط ضروري:

```ts
// api/fires.ts
export default async function handler() {
  const key = process.env.FIRMS_MAP_KEY // سرّي — لا يصل للمتصفح
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/DZA/1`
  const csv = await (await fetch(url)).text()

  const [head, ...rows] = csv.trim().split('\n')
  const cols = head.split(',')
  const fires = rows.map((row) => {
    const cells = row.split(',')
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]))
  })

  return Response.json({ fires, updatedAt: new Date().toISOString() })
}
```

ثم: `VITE_FIRES_API_URL=/api/fires`

**مهم:** أبقِ `sourceKind: "satellite"` و`verified: false` لنقاط الرصد الفضائي —
الواجهة تميّزها بوضوح (حدود متقطّعة + شارة «رصد فضائي — غير مؤكد») لأنها
نقاط حرارية آلية وليست حرائق مؤكدة ميدانياً.

---

## استقبال البلاغات

اضبط `VITE_REPORT_ENDPOINT` على أي عنوان يقبل `POST application/json`.
جسم الطلب:

```jsonc
{
  "lat": 36.75123,
  "lon": 5.08211,
  "wilayaCode": "06",
  "wilaya": "بجاية",
  "commune": "أميزور",
  "severity": "serious",          // moderate | serious | critical
  "description": "دخان كثيف…",
  "photo": "data:image/jpeg;base64,…", // اختياري، مضغوطة إلى 1280px
  "reportedAt": "2026-08-29T05:12:00Z",
  "userAgent": "…"
}
```

الاستجابة `2xx` تعني نجاح الاستلام. أي خطأ شبكة أو `5xx` يجعل التطبيق يحفظ البلاغ
في `localStorage` ويعيد إرساله تلقائياً عند عودة الاتصال.

خيارات جاهزة: دالة Vercel، Cloudflare Worker، Formspree، Google Apps Script، n8n…

```ts
// api/report.ts — مثال بسيط يعيد التوجيه إلى Webhook
export default async function handler(request: Request) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const report = await request.json()
  await fetch(process.env.REPORT_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  })
  return new Response(null, { status: 204 })
}
```

ثم: `VITE_REPORT_ENDPOINT=/api/report`

---

## بنية المشروع

```
src/
├─ main.tsx              نقطة الدخول + تسجيل عامل الخدمة
├─ App.tsx               الهيكل العام، الترويسة، التنقّل
├─ types.ts              أنواع البيانات المشتركة
├─ hooks/
│  ├─ useFires.ts        جلب الحرائق + التحديث الدوري
│  └─ useHashRoute.ts    موجّه بسيط عبر hash (بلا مكتبة)
├─ lib/
│  ├─ config.ts          كل متغيرات البيئة في مكان واحد
│  ├─ api.ts             جلب الحرائق + إرسال البلاغات + طابور محلي
│  ├─ filters.ts         المرشّحات والإحصاءات والتجميع
│  ├─ format.ts          التسميات وصياغة الأوقات والأعداد بالعربية
│  └─ image.ts           ضغط الصور قبل الإرسال
├─ data/
│  ├─ wilayas.ts         الولايات الـ58 وإحداثياتها
│  ├─ demoFires.ts       ⚠️ بيانات تجريبية فقط
│  └─ emergency.ts       أرقام الطوارئ وإرشادات السلامة
├─ components/           الخريطة، التفاصيل، المرشّحات، البطاقات، التنقّل
└─ pages/                الرئيسية · الخريطة · الإبلاغ · الطوارئ
```

## النشر على Vercel

1. اربط المستودع بمشروع Vercel.
2. الإطار يُكتشف تلقائياً (Vite) — `vercel.json` موجود مسبقاً.
3. أضف متغيرات البيئة إن رغبت في مصدر بيانات أو وجهة بلاغات حقيقية.
4. انشر. لا حاجة لأي قاعدة بيانات أو خادم.

---

## ما لا يفعله هذا المشروع عمداً

لا حسابات مستخدمين · لا لوحة تحكم · لا قاعدة بيانات · لا إشعارات · لا محادثة ·
لا تبرعات · لا ميزات اجتماعية · لا تعدد لغات.

## أرقام الطوارئ

| الجهة | الرقم |
|---|---|
| الحماية المدنية | **14** (الرقم الأخضر 1021) |
| الشرطة | **17** (الرقم الأخضر 1548) |
| الدرك الوطني | **1055** |
| الاستعجالات الطبية (SAMU) | **115** |

هذا التطبيق أداة توعية وتتبّع، **ولا يُغني عن الاتصال بالجهات المختصة**.
