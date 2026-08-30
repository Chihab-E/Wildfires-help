/** أنواع البيانات المشتركة لكل التطبيق. */

/** شدة الحريق. */
export type Severity = 'moderate' | 'serious' | 'critical'

/** حالة الحريق على الأرض. */
export type FireStatus = 'active' | 'contained' | 'extinguished'

/**
 * مصدر المعلومة:
 * - `satellite`: رصد فضائي آلي (مثل FIRMS/VIIRS) — نقطة حرارية غير مؤكدة ميدانياً.
 * - `official`: بلاغ من جهة رسمية (الحماية المدنية، محافظة الغابات...).
 * - `report`: بلاغ مواطن يصل من مصدر خارجي. التطبيق نفسه لا ينتجه
 *   (نموذج الإبلاغ مُزال حالياً)، لكن المحوّل يقبله إن ورد من API.
 */
export type SourceKind = 'satellite' | 'official' | 'report'

/** حريق واحد كما يعرضه التطبيق. */
export interface Fire {
  id: string
  lat: number
  lon: number
  wilayaCode: string
  wilaya: string
  commune: string
  severity: Severity
  status: FireStatus
  /** ISO 8601 */
  reportedAt: string
  /** ISO 8601 — آخر تحديث للمعلومة، إن وُجد */
  updatedAt?: string
  sourceKind: SourceKind
  /** اسم المصدر كما يُعرض للمستخدم */
  sourceName: string
  sourceUrl?: string
  /**
   * `true` فقط عندما تؤكد جهة رسمية الحريق ميدانياً.
   * الرصد الفضائي وحده لا يُعتبر تأكيداً.
   */
  verified: boolean
  /** ثقة الرصد الفضائي 0..100 (إن توفرت) */
  confidence?: number
  /** عدد النقاط الحرارية التي اندمجت في هذا التجمّع (للرصد الفضائي) */
  detectionCount?: number
  notes?: string
}

/** مرشّحات الخريطة. */
export type FilterKey = 'all' | 'active' | 'verified' | 'recent'

/** نتيجة جلب الحرائق مع بيانات المصدر. */
export interface FiresPayload {
  fires: Fire[]
  /** ISO 8601 — وقت آخر تحديث للبيانات */
  updatedAt: string
  /** هل البيانات تجريبية (لا يوجد API مضبوط)؟ */
  isDemo: boolean
  /** وصف المصدر المستخدم */
  sourceLabel: string
  /** سبب اللجوء للبيانات التجريبية، إن وُجد */
  notice?: string
  /** تفصيل تقني للعطل — يُعرض مطوياً لمن ينشر الموقع */
  diagnostic?: string
}
