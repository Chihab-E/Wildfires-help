/** معرّف المطوّر على إنستغرام. */
export const DEV_INSTAGRAM = 'chihab._tech'

/** سطر نسب المشروع لمطوّره. */
export function DevCredit({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-muted ${className}`}>
      تطوير{' '}
      <a
        href={`https://instagram.com/${DEV_INSTAGRAM}`}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 font-bold text-body underline decoration-line underline-offset-2"
      >
        <span aria-hidden="true">📸</span>
        <span dir="ltr">@{DEV_INSTAGRAM}</span>
      </a>
    </p>
  )
}
