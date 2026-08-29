/**
 * كل الإعدادات القابلة للتغيير عبر متغيرات البيئة (.env).
 * التطبيق يعمل كاملاً بدون أي متغير — عندها يستخدم بيانات تجريبية موسومة بوضوح.
 */

const env = import.meta.env

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export const config = {
  /**
   * نقطة نهاية تُعيد الحرائق (JSON).
   * فارغة => بيانات تجريبية.
   * انظر src/lib/api.ts للصيغ المدعومة (GeoJSON أو مصفوفة).
   */
  firesApiUrl: str(env.VITE_FIRES_API_URL),

  /** ترويسة اعتماد اختيارية للـ API أعلاه، مثل: `Bearer xxx` */
  firesApiAuth: str(env.VITE_FIRES_API_AUTH),

  /**
   * نقطة نهاية استقبال البلاغات (POST JSON).
   * تعمل مع أي خدمة: Vercel Function، Formspree، Google Apps Script، n8n، Cloudflare Worker...
   * فارغة => يُحفظ البلاغ محلياً فقط ويُنبَّه المستخدم.
   */
  reportEndpoint: str(env.VITE_REPORT_ENDPOINT),

  /** ترويسة اعتماد اختيارية لنقطة البلاغات */
  reportEndpointAuth: str(env.VITE_REPORT_ENDPOINT_AUTH),

  /** بلاط الخريطة — يمكن استبداله بأي مزوّد (MapTiler، Stadia...) */
  tileUrl:
    str(env.VITE_MAP_TILE_URL) || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

  tileAttribution:
    str(env.VITE_MAP_TILE_ATTRIBUTION) ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',

  /** مدة إعادة الجلب التلقائي بالدقائق (0 = تعطيل) */
  refreshMinutes: Number(env.VITE_REFRESH_MINUTES ?? 10) || 0,

  /** كم ساعة يُعتبر خلالها الحريق "حديثاً" */
  recentHours: Number(env.VITE_RECENT_HOURS ?? 24) || 24,
} as const

/** هل هناك مصدر بيانات حقيقي مضبوط؟ */
export const hasLiveApi = config.firesApiUrl.length > 0

/** هل هناك وجهة حقيقية لاستقبال البلاغات؟ */
export const hasReportEndpoint = config.reportEndpoint.length > 0

/** حدود الجزائر التقريبية لضبط الخريطة. */
export const ALGERIA_BOUNDS: [[number, number], [number, number]] = [
  [18.9, -8.7],
  [37.4, 12.0],
]

/** مركز افتراضي للخريطة (شمال الجزائر حيث تتركز الحرائق). */
export const DEFAULT_CENTER: [number, number] = [34.6, 3.2]
export const DEFAULT_ZOOM = 6
