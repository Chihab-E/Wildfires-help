/**
 * الولايات الجزائرية الـ58 مع الإحداثيات التقريبية لمركز كل ولاية.
 *
 * تُستعمل في الواجهة فقط: دالة الخادم تُعيد الإحداثيات وحدها،
 * و`normalizeFire` هنا تستنتج الولاية منها.
 */

export interface Wilaya {
  code: string
  name: string
  lat: number
  lon: number
}

export const WILAYAS: Wilaya[] = [
  { code: '01', name: 'أدرار', lat: 27.87, lon: -0.29 },
  { code: '02', name: 'الشلف', lat: 36.17, lon: 1.33 },
  { code: '03', name: 'الأغواط', lat: 33.8, lon: 2.87 },
  { code: '04', name: 'أم البواقي', lat: 35.87, lon: 7.11 },
  { code: '05', name: 'باتنة', lat: 35.55, lon: 6.17 },
  { code: '06', name: 'بجاية', lat: 36.75, lon: 5.08 },
  { code: '07', name: 'بسكرة', lat: 34.85, lon: 5.73 },
  { code: '08', name: 'بشار', lat: 31.62, lon: -2.22 },
  { code: '09', name: 'البليدة', lat: 36.47, lon: 2.83 },
  { code: '10', name: 'البويرة', lat: 36.37, lon: 3.9 },
  { code: '11', name: 'تمنراست', lat: 22.79, lon: 5.53 },
  { code: '12', name: 'تبسة', lat: 35.4, lon: 8.12 },
  { code: '13', name: 'تلمسان', lat: 34.88, lon: -1.32 },
  { code: '14', name: 'تيارت', lat: 35.37, lon: 1.32 },
  { code: '15', name: 'تيزي وزو', lat: 36.72, lon: 4.05 },
  { code: '16', name: 'الجزائر', lat: 36.75, lon: 3.06 },
  { code: '17', name: 'الجلفة', lat: 34.67, lon: 3.26 },
  { code: '18', name: 'جيجل', lat: 36.82, lon: 5.77 },
  { code: '19', name: 'سطيف', lat: 36.19, lon: 5.41 },
  { code: '20', name: 'سعيدة', lat: 34.83, lon: 0.15 },
  { code: '21', name: 'سكيكدة', lat: 36.88, lon: 6.91 },
  { code: '22', name: 'سيدي بلعباس', lat: 35.19, lon: -0.63 },
  { code: '23', name: 'عنابة', lat: 36.9, lon: 7.77 },
  { code: '24', name: 'قالمة', lat: 36.46, lon: 7.43 },
  { code: '25', name: 'قسنطينة', lat: 36.37, lon: 6.61 },
  { code: '26', name: 'المدية', lat: 36.26, lon: 2.75 },
  { code: '27', name: 'مستغانم', lat: 35.93, lon: 0.09 },
  { code: '28', name: 'المسيلة', lat: 35.7, lon: 4.54 },
  { code: '29', name: 'معسكر', lat: 35.4, lon: 0.14 },
  { code: '30', name: 'ورقلة', lat: 31.95, lon: 5.32 },
  { code: '31', name: 'وهران', lat: 35.7, lon: -0.63 },
  { code: '32', name: 'البيض', lat: 33.68, lon: 1.02 },
  { code: '33', name: 'إليزي', lat: 26.48, lon: 8.47 },
  { code: '34', name: 'برج بوعريريج', lat: 36.07, lon: 4.76 },
  { code: '35', name: 'بومرداس', lat: 36.76, lon: 3.47 },
  { code: '36', name: 'الطارف', lat: 36.77, lon: 8.31 },
  { code: '37', name: 'تندوف', lat: 27.67, lon: -8.15 },
  { code: '38', name: 'تيسمسيلت', lat: 35.61, lon: 1.81 },
  { code: '39', name: 'الوادي', lat: 33.37, lon: 6.87 },
  { code: '40', name: 'خنشلة', lat: 35.44, lon: 7.14 },
  { code: '41', name: 'سوق أهراس', lat: 36.29, lon: 7.95 },
  { code: '42', name: 'تيبازة', lat: 36.59, lon: 2.45 },
  { code: '43', name: 'ميلة', lat: 36.45, lon: 6.26 },
  { code: '44', name: 'عين الدفلى', lat: 36.26, lon: 1.97 },
  { code: '45', name: 'النعامة', lat: 33.27, lon: -0.31 },
  { code: '46', name: 'عين تموشنت', lat: 35.3, lon: -1.14 },
  { code: '47', name: 'غرداية', lat: 32.49, lon: 3.67 },
  { code: '48', name: 'غليزان', lat: 35.74, lon: 0.56 },
  { code: '49', name: 'تيميمون', lat: 29.26, lon: 0.24 },
  { code: '50', name: 'برج باجي مختار', lat: 21.33, lon: 0.95 },
  { code: '51', name: 'أولاد جلال', lat: 34.42, lon: 5.06 },
  { code: '52', name: 'بني عباس', lat: 30.13, lon: -2.17 },
  { code: '53', name: 'عين صالح', lat: 27.2, lon: 2.47 },
  { code: '54', name: 'عين قزام', lat: 19.56, lon: 5.77 },
  { code: '55', name: 'تقرت', lat: 33.1, lon: 6.06 },
  { code: '56', name: 'جانت', lat: 24.55, lon: 9.48 },
  { code: '57', name: 'المغير', lat: 33.95, lon: 5.92 },
  { code: '58', name: 'المنيعة', lat: 30.58, lon: 2.88 },
]

const BY_CODE = new Map(WILAYAS.map((w) => [w.code, w]))

export function wilayaByCode(code: string): Wilaya | undefined {
  return BY_CODE.get(code)
}

/**
 * أقرب ولاية لنقطة جغرافية — تقدير تقريبي يعتمد على مراكز الولايات.
 * يُستخدم فقط لملء الحقل تلقائياً في نموذج البلاغ، ويبقى المستخدم قادراً على تغييره.
 */
export function nearestWilaya(lat: number, lon: number): Wilaya {
  let best = WILAYAS[0]
  let bestDist = Number.POSITIVE_INFINITY
  const latRad = (lat * Math.PI) / 180
  const cos = Math.cos(latRad)

  for (const w of WILAYAS) {
    const dLat = w.lat - lat
    const dLon = (w.lon - lon) * cos
    const dist = dLat * dLat + dLon * dLon
    if (dist < bestDist) {
      bestDist = dist
      best = w
    }
  }
  return best
}
