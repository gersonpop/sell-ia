"use client";

import {useLocale, useTranslations} from "next-intl";
import {usePathname, useRouter} from "@/i18n/navigation";

const locales = [
  {code: "es", label: "ES"},
  {code: "en", label: "EN"},
  {code: "fr", label: "FR"},
] as const;

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/20 px-2 py-2 text-white shadow-sm backdrop-blur-md">
      <span className="grid size-7 place-items-center rounded-full bg-white/85 text-slate-900">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
          <path d="M13.7 14.6a6.7 6.7 0 1 0-2.5-12.9 6.7 6.7 0 0 0 2.5 12.9Z" />
          <path d="M7.7 6.5h12.1M8.5 10.2h10.6M13.8 2.1c1.1 1.2 1.8 2.9 1.8 4.9s-.7 3.8-1.8 5M13.8 2.1c-1.1 1.2-1.8 2.9-1.8 4.9s.7 3.8 1.8 5" />
          <path d="M3.5 15.1h6.5c1.3 0 2.4 1 2.4 2.3v2.1c0 1.3-1 2.3-2.4 2.3H6.9l-2.6 1.8v-1.8c-1.3 0-2.3-1-2.3-2.3v-2.1c0-1.3 1-2.3 2.3-2.3Z" />
          <path d="M5.5 17.6h3.9M5.5 19.4h2.9" />
        </svg>
      </span>

      <div className="inline-flex items-center gap-1" role="group" aria-label={t("label")}>
        {locales.map(({code, label}) => {
          const active = locale === code;

          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              onClick={() => router.replace(pathname, {locale: code})}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active
                  ? "bg-white text-slate-900 shadow-[0_3px_10px_rgba(15,23,42,0.2)]"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
