/**
 * منطق تحويل بيانات NASA FIRMS — مفصول عن الدالة نفسها ليمكن اختباره.
 *
 * FIRMS يرصد "نقاطاً حرارية" (thermal anomalies) عبر الأقمار الصناعية.
 * هذه ليست حرائق مؤكدة ميدانياً، ولذلك كل ما يخرج من هنا يحمل:
 *   sourceKind: 'satellite'  و  verified: false
 * والواجهة تعرضه بحدود متقطّعة وشارة «رصد فضائي — غير مؤكد».
 */

import { nearestWilaya } from '../shared/wilayas.ts'

export type Severity = 'moderate' | 'serious' | 'critical'

export interface FirmsFire {
  id: string
  lat: number
  lon: number
  wilayaCode: string
  wilaya: string
  commune: string
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

/* ------------------------------- تحليل CSV ------------------------------- */

/** محلّل CSV بسيط يكفي لمخرجات FIRMS (لا حقول تحوي فواصل أو اقتباسات). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim())
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

/* ------------------------------ حقول FIRMS ------------------------------ */

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

/** `acq_date`=2026-08-29 + `acq_time`=1435 (UTC) → ISO 8601 */
export function parseAcquisition(date: string | undefined, time: string | undefined): string | null {
  if (!date) return null
  const padded = (time ?? '0000').padStart(4, '0')
  const iso = `${date}T${padded.slice(0, 2)}:${padded.slice(2, 4)}:00Z`
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/* ------------------------------- التجميع -------------------------------- */

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

/* ------------------------------- التحويل -------------------------------- */

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

/** يحوّل صفوف CSV الخام إلى قائمة حرائق مجمّعة وجاهزة للعرض. */
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
    const wilaya = nearestWilaya(lat, lon)

    const confidences = group.map((p) => p.confidence).filter((c): c is number => c !== undefined)
    const confidence =
      confidences.length > 0 ? Math.round(Math.max(...confidences)) : undefined

    return {
      id: `firms-${lat.toFixed(4)}-${lon.toFixed(4)}-${latest.time}`,
      lat,
      lon,
      wilayaCode: wilaya.code,
      wilaya: wilaya.name,
      commune: 'غير محددة',
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
