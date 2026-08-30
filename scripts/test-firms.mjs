/**
 * اختبار منطق تحويل FIRMS على عيّنة CSV واقعية.
 * التشغيل: npm run test:firms
 */
import {
  parseCsv,
  parseConfidence,
  severityFromFrp,
  parseAcquisition,
  inAlgeria,
  firmsRowsToFires,
} from '../api/fires.ts'

let failures = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n    توقعنا ${JSON.stringify(expected)} وحصلنا على ${JSON.stringify(actual)}`}`)
}

/* ---------- عيّنة بصيغة country API الحقيقية لـ VIIRS ---------- */
const CSV = `country_id,latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
DZA,36.7412,4.4691,331.2,0.42,0.45,2026-08-29,1312,N,VIIRS,n,2.0NRT,295.1,12.4,D
DZA,36.7429,4.4708,340.8,0.42,0.45,2026-08-29,1312,N,VIIRS,h,2.0NRT,298.3,44.9,D
DZA,36.7401,4.4670,352.1,0.42,0.45,2026-08-29,1314,N,VIIRS,h,2.0NRT,301.7,61.2,D
DZA,36.8102,5.6520,318.9,0.51,0.48,2026-08-29,0208,1,VIIRS,l,2.0NRT,288.4,3.1,N
DZA,35.5511,6.1702,336.4,0.39,0.44,2026-08-28,1330,N,VIIRS,n,2.0NRT,296.8,21.7,D
DZA,48.9000,2.3500,330.0,0.40,0.44,2026-08-29,1300,N,VIIRS,n,2.0NRT,295.0,10.0,D
DZA,36.7415,4.4695,,0.42,0.45,,,N,VIIRS,n,2.0NRT,,,D`

/* ---------- الوحدات الصغيرة ---------- */
check('parseConfidence: VIIRS letters', ['l', 'n', 'h'].map(parseConfidence), [20, 60, 90])
check('parseConfidence: MODIS numeric', parseConfidence('73'), 73)
check('parseConfidence: garbage', parseConfidence('xyz'), undefined)
check('severityFromFrp thresholds', [5, 20, 80].map(severityFromFrp), [
  'moderate',
  'serious',
  'critical',
])
check('parseAcquisition pads time', parseAcquisition('2026-08-29', '312'), '2026-08-29T03:12:00.000Z')
check('parseAcquisition rejects empty date', parseAcquisition('', '1312'), null)
/*
 * ترشيح الحدود: واجهة `area` في FIRMS تُعيد مستطيلاً يشمل تونس وليبيا
 * والنيجر ومالي والمغرب، فالمضلّع هو ما يمنع عرض حرائق أجنبية كجزائرية.
 * النقطتان «عيّنة …» مأخوذتان من رد FIRMS الحقيقي وكلتاهما في تونس.
 */
const INSIDE = [
  [36.7538, 3.0588, 'الجزائر العاصمة'], [36.75, 5.0843, 'بجاية'],
  [36.8206, 5.7667, 'جيجل'], [36.8102, 5.652, 'نقطة ساحلية على بعد 2 كم في البحر'], [36.7169, 4.0497, 'تيزي وزو'],
  [35.6976, -0.6337, 'وهران'], [22.785, 5.5228, 'تمنراست'],
  [36.9, 7.7667, 'عنابة'], [27.8743, -0.2939, 'أدرار'],
  [36.9077, 8.1904, 'القالة'], [35.4, 8.12, 'تبسة'],
]
const OUTSIDE = [
  [36.8065, 10.1815, 'تونس العاصمة'], [32.8872, 13.1913, 'طرابلس'],
  [34.0209, -6.8416, 'الرباط'], [13.5116, 2.1254, 'نيامي'],
  [34.6814, 10.0963, 'صفاقس'], [31.6, -8.0, 'مراكش'], [48.9, 2.35, 'باريس'],
  [35.77581, 9.89052, 'عيّنة FIRMS حقيقية 1'], [33.36421, 8.54837, 'عيّنة FIRMS حقيقية 2'],
]
check('حدود: كل المدن الجزائرية داخل',
  INSIDE.filter(([la, lo]) => !inAlgeria(la, lo)).map((c) => c[2]), [])
check('حدود: كل النقاط الأجنبية خارج',
  OUTSIDE.filter(([la, lo]) => inAlgeria(la, lo)).map((c) => c[2]), [])

/* ---------- التحليل الكامل ---------- */
const rows = parseCsv(CSV)
check('parseCsv row count', rows.length, 7)
check('parseCsv reads a field', rows[0].confidence, 'n')

const fires = firmsRowsToFires(rows)

// 3 نقاط متجاورة في تيزي وزو تندمج، + جيجل + باتنة = 3 تجمّعات
// (باريس مستبعدة، والصف الناقص مستبعد)
check('clusters adjacent detections', fires.length, 3)

const tizi = fires.find((f) => Math.abs(f.lat - 36.74) < 0.05)
check('cluster merges 3 pixels', tizi.detectionCount, 3)
check('cluster sums FRP into severity', tizi.severity, 'critical') // 12.4+44.9+61.2 = 118.5
check('cluster takes max confidence', tizi.confidence, 90)
check('cluster uses latest acquisition', tizi.reportedAt, '2026-08-29T13:14:00.000Z')
check('satellite points are never verified', [...new Set(fires.map((f) => f.verified))], [false])
check('satellite points are marked as such', [...new Set(fires.map((f) => f.sourceKind))], [
  'satellite',
])
// الخادم لا يُسنِد ولاية عمداً: الواجهة تستنتجها من الإحداثيات
check('server assigns no wilaya', 'wilaya' in fires[0], false)

const jijel = fires.find((f) => Math.abs(f.lat - 36.81) < 0.05)
check('low FRP stays moderate', jijel.severity, 'moderate')

console.log(`\n${failures === 0 ? 'كل الاختبارات نجحت' : `${failures} اختبار فشل`}`)
process.exit(failures === 0 ? 0 : 1)
