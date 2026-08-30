import { useCallback, useId, useRef, useState } from 'react'
import { FireMap } from '../components/FireMap'
import { WILAYAS, nearestWilaya, wilayaByCode } from '../data/wilayas'
import { submitReport } from '../lib/api'
import { hasReportEndpoint } from '../lib/config'
import { SEVERITY_EMOJI, SEVERITY_LABEL } from '../lib/format'
import { compressImage } from '../lib/image'
import { navigateTo } from '../hooks/useHashRoute'
import type { FireReport, Severity } from '../types'

type Submission =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent' }
  | { state: 'queued'; reason: 'no-endpoint' | 'offline' }
  | { state: 'error'; message: string }

const SEVERITIES: Severity[] = ['moderate', 'serious', 'critical']

export function ReportPage() {
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null)
  const [wilayaCode, setWilayaCode] = useState('')
  const [commune, setCommune] = useState('')
  const [severity, setSeverity] = useState<Severity>('serious')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<Submission>({ state: 'idle' })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const ids = useId()

  /** اختيار نقطة يملأ الولاية تلقائياً ما لم يغيّرها المستخدم يدوياً. */
  const wilayaTouched = useRef(false)

  const setLocation = useCallback((lat: number, lon: number) => {
    setPoint({ lat, lon })
    setLocationError(null)
    if (!wilayaTouched.current) {
      setWilayaCode(nearestWilaya(lat, lon).code)
    }
  }, [])

  const useMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('تحديد الموقع غير مدعوم على هذا الجهاز.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        setLocation(position.coords.latitude, position.coords.longitude)
      },
      () => {
        setLocating(false)
        setLocationError('تعذّر تحديد موقعك. حدّد النقطة على الخريطة بنفسك.')
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    )
  }, [setLocation])

  const onPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoError(null)
    try {
      setPhoto(await compressImage(file))
    } catch (error) {
      setPhoto(null)
      setPhotoError(error instanceof Error ? error.message : 'تعذّرت معالجة الصورة.')
    }
  }

  const clearPhoto = () => {
    setPhoto(null)
    setPhotoError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!point) {
      setLocationError('حدّد موقع الحريق أولاً.')
      return
    }
    const wilaya = wilayaByCode(wilayaCode)
    if (!wilaya) return

    setSubmission({ state: 'sending' })

    const report: FireReport = {
      lat: Number(point.lat.toFixed(5)),
      lon: Number(point.lon.toFixed(5)),
      wilayaCode: wilaya.code,
      wilaya: wilaya.name,
      commune: commune.trim(),
      severity,
      description: description.trim(),
      photo: photo ?? undefined,
      reportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    }

    const outcome = await submitReport(report)
    if (!outcome.ok) {
      setSubmission({ state: 'error', message: outcome.error })
      return
    }
    setSubmission(outcome.queued ? { state: 'queued', reason: outcome.reason } : { state: 'sent' })
  }

  if (submission.state === 'sent' || submission.state === 'queued') {
    return (
      <SubmissionResult
        submission={submission}
        onReset={() => {
          setSubmission({ state: 'idle' })
          setPoint(null)
          setCommune('')
          setDescription('')
          clearPhoto()
          wilayaTouched.current = false
        }}
      />
    )
  }

  const sending = submission.state === 'sending'

  return (
    <div className="mx-auto max-w-lg px-3 pb-6">
      <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-900">
        <strong className="font-bold">في حالة خطر مباشر، اتصل أولاً:</strong> الحماية المدنية{' '}
        <a className="num font-bold underline" href="tel:14">
          14
        </a>{' '}
        · هذا النموذج لا يُغني عن الاتصال بالجهات المختصة.
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* الموقع */}
        <Field label="موقع الحريق" required>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="flex-1 rounded-xl border border-line bg-subtle px-3 py-2.5 text-sm font-bold text-body active:bg-raised disabled:opacity-60"
            >
              {locating ? 'جارٍ التحديد…' : '📡 استخدام موقعي'}
            </button>
            {point && (
              <button
                type="button"
                onClick={() => setPoint(null)}
                className="rounded-xl border border-line bg-subtle px-3 py-2.5 text-sm text-muted active:bg-raised"
              >
                مسح
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-muted">أو انقر على الخريطة لتحديد المكان بدقة.</p>

          <FireMap
            fires={[]}
            pickMode
            pickedPoint={point}
            onPick={setLocation}
            className="mt-2 h-64 w-full overflow-hidden rounded-2xl border border-line"
          />

          {point && (
            <p className="num mt-2 text-center text-xs text-muted">
              {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
            </p>
          )}
          {locationError && <ErrorText>{locationError}</ErrorText>}
        </Field>

        {/* الولاية */}
        <Field label="الولاية" required htmlFor={`${ids}-wilaya`}>
          <select
            id={`${ids}-wilaya`}
            required
            value={wilayaCode}
            onChange={(event) => {
              wilayaTouched.current = true
              setWilayaCode(event.target.value)
            }}
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base text-strong outline-none focus:border-red-500"
          >
            <option value="" disabled>
              اختر الولاية
            </option>
            {WILAYAS.map((wilaya) => (
              <option key={wilaya.code} value={wilaya.code}>
                {wilaya.code} — {wilaya.name}
              </option>
            ))}
          </select>
        </Field>

        {/* البلدية */}
        <Field label="البلدية" required htmlFor={`${ids}-commune`}>
          <input
            id={`${ids}-commune`}
            required
            value={commune}
            onChange={(event) => setCommune(event.target.value)}
            placeholder="مثال: أزفون"
            maxLength={80}
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base text-strong placeholder:text-muted outline-none focus:border-red-500"
          />
        </Field>

        {/* الشدة */}
        <Field label="شدة الحريق" required>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSeverity(option)}
                aria-pressed={severity === option}
                className={`rounded-xl border px-2 py-3 text-sm font-bold ${
                  severity === option
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-line bg-subtle text-muted'
                }`}
              >
                <span className="block text-lg leading-none" aria-hidden="true">
                  {SEVERITY_EMOJI[option]}
                </span>
                <span className="mt-1 block">{SEVERITY_LABEL[option]}</span>
              </button>
            ))}
          </div>
        </Field>

        {/* الوصف */}
        <Field label="الوصف" htmlFor={`${ids}-description`}>
          <textarea
            id={`${ids}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="ماذا ترى؟ اتجاه الدخان، قرب المنازل، أقرب طريق…"
            className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-3 text-base text-strong placeholder:text-muted outline-none focus:border-red-500"
          />
          <p className="mt-1 text-end text-xs text-muted">
            <span className="num">{description.length}/1000</span>
          </p>
        </Field>

        {/* الصورة */}
        <Field label="صورة (اختياري)" htmlFor={`${ids}-photo`}>
          {/* حقل الملف الأصلي مخفي: نصّه الافتراضي إنجليزي من المتصفح */}
          <input
            id={`${ids}-photo`}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoChange}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border border-line bg-subtle px-3 py-3 text-sm font-bold text-body active:bg-raised"
          >
            📷 {photo ? 'تغيير الصورة' : 'إضافة صورة'}
          </button>
          {photo && (
            <div className="mt-2">
              <img
                src={photo}
                alt="معاينة الصورة المرفقة"
                className="max-h-56 w-full rounded-xl border border-line object-cover"
              />
              <button
                type="button"
                onClick={clearPhoto}
                className="mt-2 w-full rounded-xl border border-line bg-subtle py-2 text-sm text-muted active:bg-raised"
              >
                إزالة الصورة
              </button>
            </div>
          )}
          {photoError && <ErrorText>{photoError}</ErrorText>}
        </Field>

        {submission.state === 'error' && <ErrorText>{submission.message}</ErrorText>}

        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-2xl bg-red-600 px-4 py-4 text-lg font-bold text-white shadow-lg shadow-red-600/25 active:bg-red-700 disabled:opacity-60"
        >
          {sending ? 'جارٍ الإرسال…' : '🔥 إرسال البلاغ'}
        </button>

        {!hasReportEndpoint && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            لا توجد جهة تستقبل البلاغات حالياً، لذلك سيُحفظ بلاغك على هذا الجهاز فقط ولن يصل
            إلى أحد. اتصل بالحماية المدنية مباشرة.
          </p>
        )}
      </form>
    </div>
  )
}

function SubmissionResult({
  submission,
  onReset,
}: {
  submission: { state: 'sent' } | { state: 'queued'; reason: 'no-endpoint' | 'offline' }
  onReset: () => void
}) {
  const sent = submission.state === 'sent'

  return (
    <div className="mx-auto max-w-lg px-3 py-8 text-center">
      <p className="text-5xl" aria-hidden="true">
        {sent ? '✅' : '📥'}
      </p>
      <h2 className="mt-3 text-xl font-bold text-strong">
        {sent ? 'تم إرسال البلاغ' : 'حُفظ البلاغ على جهازك'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {sent
          ? 'شكراً لك. تُراجَع البلاغات قبل اعتمادها كحريق مؤكد.'
          : submission.reason === 'offline'
            ? 'انقطع الاتصال. سيُرسَل بلاغك تلقائياً بمجرد عودة الشبكة.'
            : 'لا توجد جهة تستقبل البلاغات حالياً، فبقي بلاغك محفوظاً على جهازك.'}
      </p>
      <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        إن كان الخطر مباشراً فاتصل بالحماية المدنية على{' '}
        <a className="num font-bold underline" href="tel:14">
          14
        </a>
        .
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onReset}
          className="flex-1 rounded-xl border border-line bg-subtle py-3 font-bold text-body active:bg-raised"
        >
          بلاغ آخر
        </button>
        <button
          type="button"
          onClick={() => navigateTo('home')}
          className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white active:bg-red-700"
        >
          الرئيسية
        </button>
      </div>
    </div>
  )
}

/**
 * حقل نموذج. عند تمرير `htmlFor` يُربط العنوان بعنصر إدخال واحد؛
 * وإلا يبقى عنواناً وصفياً (حالة الخريطة وأزرار الشدة).
 */
function Field({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
}) {
  const title = (
    <>
      {label}
      {required && <span className="ms-1 text-red-400">*</span>}
    </>
  )

  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-body">
          {title}
        </label>
      ) : (
        <p className="mb-1.5 block text-sm font-bold text-body">{title}</p>
      )}
      {children}
    </div>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-sm font-medium text-red-700">{children}</p>
}
