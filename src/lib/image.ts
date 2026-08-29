/** ضغط الصور قبل الإرسال — البلاغات تُرسل من الهاتف غالباً عبر شبكة ضعيفة. */

const MAX_DIMENSION = 1280
const QUALITY = 0.72
/** حد أقصى للملف الأصلي قبل الضغط */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

/**
 * يقرأ صورة ويُعيدها كـ data URL بصيغة JPEG بعد تصغيرها.
 * يرمي خطأً برسالة عربية إن تعذّر ذلك.
 */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('الملف المختار ليس صورة.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('حجم الصورة كبير جداً (الحد 12 ميغابايت).')
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('تعذّرت قراءة الصورة.')
  })

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('تعذّرت معالجة الصورة على هذا الجهاز.')
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', QUALITY)
}
