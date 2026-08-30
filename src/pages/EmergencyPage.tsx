import { EMERGENCY_CONTACTS, SAFETY_GUIDE } from '../data/emergency'
import { DevCredit } from '../components/DevCredit'

export function EmergencyPage() {
  return (
    <div className="mx-auto max-w-lg px-3 pb-6">
      <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-900">
        <strong className="font-bold">في حالة خطر مباشر اتصل فوراً بالحماية المدنية على الرقم</strong>{' '}
        <a className="num text-lg font-bold underline" href="tel:14">
          14
        </a>
        . كل الأرقام أدناه مجانية ومتاحة على مدار الساعة من أي هاتف.
      </div>

      <section aria-label="أرقام الطوارئ">
        <h2 className="mb-2 text-base font-bold text-strong">🚨 أرقام الطوارئ</h2>
        <ul className="space-y-2.5">
          {EMERGENCY_CONTACTS.map((contact) => (
            <li key={contact.id}>
              <div
                className={`rounded-2xl border p-3 ${
                  contact.primary
                    ? 'border-red-200 bg-red-50'
                    : 'border-line bg-subtle/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {contact.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-strong">{contact.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {contact.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <a
                    href={`tel:${contact.number}`}
                    className={`num flex-1 rounded-xl px-3 py-3 text-center text-lg font-bold ${
                      contact.primary
                        ? 'bg-red-600 text-white active:bg-red-700'
                        : 'border border-red-200 bg-red-50 text-red-700 active:bg-red-100'
                    }`}
                  >
                    📞 {contact.number}
                  </a>
                  {contact.altNumber && (
                    <a
                      href={`tel:${contact.altNumber}`}
                      className="flex-1 rounded-xl border border-line bg-surface px-3 py-3 text-center text-sm font-bold text-body shadow-sm active:bg-subtle"
                    >
                      <span className="block text-xs text-muted">{contact.altLabel}</span>
                      <span className="num">{contact.altNumber}</span>
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6" aria-label="إرشادات السلامة">
        <h2 className="mb-2 text-base font-bold text-strong">🛟 إرشادات السلامة من حرائق الغابات</h2>
        <div className="space-y-2.5">
          {SAFETY_GUIDE.map((group) => (
            <details
              key={group.title}
              className="overflow-hidden rounded-2xl border border-line bg-subtle/60"
            >
              <summary className="cursor-pointer list-none p-3 font-bold text-strong marker:hidden">
                <span className="me-2" aria-hidden="true">
                  {group.icon}
                </span>
                {group.title}
              </summary>
              <ul className="space-y-2 border-t border-line p-3 text-sm leading-relaxed text-body">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-6 rounded-2xl border border-line bg-subtle/50 p-3 text-xs leading-relaxed text-muted">
        هذه الصفحة للتوعية العامة ولا تُغني عن تعليمات السلطات المحلية. اتبع دائماً توجيهات الحماية
        المدنية وأعوان الغابات في منطقتك.
      </p>

      <DevCredit className="mt-5" />
    </div>
  )
}
