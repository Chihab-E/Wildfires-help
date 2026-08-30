import type { Fire } from '../types'

/**
 * ⚠️ بيانات تجريبية فقط — ليست حرائق حقيقية.
 *
 * تُستخدم حصراً عندما لا يكون `VITE_FIRES_API_URL` مضبوطاً، لعرض شكل التطبيق.
 * الواجهة تُظهر شارة "بيانات تجريبية" في كل مكان تظهر فيه هذه البيانات.
 *
 * الأوقات محسوبة نسبةً إلى لحظة فتح الصفحة حتى تبقى العروض منطقية.
 */

interface DemoSeed {
  id: string
  lat: number
  lon: number
  wilayaCode: string
  wilaya: string
  commune: string
  severity: Fire['severity']
  status: Fire['status']
  sourceKind: Fire['sourceKind']
  sourceName: string
  verified: boolean
  /** منذ كم ساعة أُبلغ عنه */
  hoursAgo: number
  confidence?: number
  notes?: string
}

const SEEDS: DemoSeed[] = [
  {
    id: 'demo-01',
    lat: 36.7402,
    lon: 4.4685,
    wilayaCode: '15',
    wilaya: 'تيزي وزو',
    commune: 'أزفون',
    severity: 'critical',
    status: 'active',
    sourceKind: 'official',
    sourceName: 'بلاغ رسمي (تجريبي)',
    verified: true,
    hoursAgo: 2,
    notes: 'حريق غابي قرب مناطق سكنية — تدخل عدة وحدات.',
  },
  {
    id: 'demo-02',
    lat: 36.8098,
    lon: 5.6512,
    wilayaCode: '18',
    wilaya: 'جيجل',
    commune: 'الطاهير',
    severity: 'serious',
    status: 'active',
    sourceKind: 'official',
    sourceName: 'بلاغ رسمي (تجريبي)',
    verified: true,
    hoursAgo: 4,
    notes: 'امتداد الحريق نحو غابة الصنوبر الحلبي.',
  },
  {
    id: 'demo-03',
    lat: 36.6221,
    lon: 5.2904,
    wilayaCode: '06',
    wilaya: 'بجاية',
    commune: 'أميزور',
    severity: 'serious',
    status: 'contained',
    sourceKind: 'official',
    sourceName: 'بلاغ رسمي (تجريبي)',
    verified: true,
    hoursAgo: 9,
  },
  {
    id: 'demo-04',
    lat: 36.9077,
    lon: 8.1904,
    wilayaCode: '36',
    wilaya: 'الطارف',
    commune: 'القالة',
    severity: 'critical',
    status: 'active',
    sourceKind: 'satellite',
    sourceName: 'رصد فضائي (تجريبي)',
    verified: false,
    hoursAgo: 1,
    confidence: 87,
  },
  {
    id: 'demo-05',
    lat: 36.5511,
    lon: 7.4212,
    wilayaCode: '24',
    wilaya: 'قالمة',
    commune: 'بوشقوف',
    severity: 'moderate',
    status: 'active',
    sourceKind: 'satellite',
    sourceName: 'رصد فضائي (تجريبي)',
    verified: false,
    hoursAgo: 3,
    confidence: 61,
  },
  {
    id: 'demo-06',
    lat: 36.4901,
    lon: 2.7106,
    wilayaCode: '09',
    wilaya: 'البليدة',
    commune: 'شريعة',
    severity: 'serious',
    status: 'active',
    sourceKind: 'official',
    sourceName: 'بلاغ رسمي (تجريبي)',
    verified: true,
    hoursAgo: 5,
    notes: 'دخان كثيف مرئي من الطريق الوطني.',
  },
  {
    id: 'demo-07',
    lat: 36.3402,
    lon: 3.9807,
    wilayaCode: '10',
    wilaya: 'البويرة',
    commune: 'الأخضرية',
    severity: 'moderate',
    status: 'contained',
    sourceKind: 'official',
    sourceName: 'بلاغ رسمي (تجريبي)',
    verified: true,
    hoursAgo: 14,
  },
  {
    id: 'demo-08',
    lat: 36.9312,
    lon: 6.7788,
    wilayaCode: '21',
    wilaya: 'سكيكدة',
    commune: 'القل',
    severity: 'moderate',
    status: 'active',
    sourceKind: 'satellite',
    sourceName: 'رصد فضائي (تجريبي)',
    verified: false,
    hoursAgo: 6,
    confidence: 48,
  },
  {
    id: 'demo-09',
    lat: 36.7681,
    lon: 3.6402,
    wilayaCode: '35',
    wilaya: 'بومرداس',
    commune: 'دلس',
    severity: 'moderate',
    status: 'extinguished',
    sourceKind: 'official',
    sourceName: 'بلاغ رسمي (تجريبي)',
    verified: true,
    hoursAgo: 27,
  },
  {
    id: 'demo-10',
    lat: 34.9012,
    lon: -1.4201,
    wilayaCode: '13',
    wilaya: 'تلمسان',
    commune: 'بني بهدل',
    severity: 'serious',
    status: 'active',
    sourceKind: 'satellite',
    sourceName: 'رصد فضائي (تجريبي)',
    verified: false,
    hoursAgo: 8,
    confidence: 74,
  },
  {
    id: 'demo-11',
    lat: 36.2011,
    lon: 1.6704,
    wilayaCode: '02',
    wilaya: 'الشلف',
    commune: 'الزبوجة',
    severity: 'moderate',
    status: 'contained',
    sourceKind: 'official',
    sourceName: 'بلاغ رسمي (تجريبي)',
    verified: true,
    hoursAgo: 19,
  },
  {
    id: 'demo-12',
    lat: 35.6011,
    lon: 6.2809,
    wilayaCode: '05',
    wilaya: 'باتنة',
    commune: 'مروانة',
    severity: 'serious',
    status: 'active',
    sourceKind: 'official',
    sourceName: 'بلاغ رسمي (تجريبي)',
    verified: true,
    hoursAgo: 11,
  },
  {
    id: 'demo-13',
    lat: 36.5104,
    lon: 6.1902,
    wilayaCode: '43',
    wilaya: 'ميلة',
    commune: 'التلاغمة',
    severity: 'moderate',
    status: 'extinguished',
    sourceKind: 'official',
    sourceName: 'بلاغ رسمي (تجريبي)',
    verified: true,
    hoursAgo: 33,
  },
  {
    id: 'demo-14',
    lat: 36.2704,
    lon: 2.6511,
    wilayaCode: '26',
    wilaya: 'المدية',
    commune: 'وزرة',
    severity: 'critical',
    status: 'active',
    sourceKind: 'satellite',
    sourceName: 'رصد فضائي (تجريبي)',
    verified: false,
    confidence: 82,
    hoursAgo: 1.5,
    notes: 'ألسنة لهب مرتفعة ورياح قوية.',
  },
  {
    id: 'demo-15',
    lat: 36.1104,
    lon: 4.8402,
    wilayaCode: '34',
    wilaya: 'برج بوعريريج',
    commune: 'المنصورة',
    severity: 'moderate',
    status: 'active',
    sourceKind: 'satellite',
    sourceName: 'رصد فضائي (تجريبي)',
    verified: false,
    hoursAgo: 7,
    confidence: 55,
  },
]

const HOUR = 60 * 60 * 1000

/** يبني قائمة الحرائق التجريبية بأوقات نسبية للحظة الحالية. */
export function buildDemoFires(now: number = Date.now()): Fire[] {
  return SEEDS.map((seed) => {
    const reportedAt = new Date(now - seed.hoursAgo * HOUR).toISOString()
    return {
      id: seed.id,
      lat: seed.lat,
      lon: seed.lon,
      wilayaCode: seed.wilayaCode,
      wilaya: seed.wilaya,
      commune: seed.commune,
      severity: seed.severity,
      status: seed.status,
      reportedAt,
      updatedAt: reportedAt,
      sourceKind: seed.sourceKind,
      sourceName: seed.sourceName,
      verified: seed.verified,
      confidence: seed.confidence,
      notes: seed.notes,
    } satisfies Fire
  })
}
