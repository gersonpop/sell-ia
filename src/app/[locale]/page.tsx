import {getTranslations, setRequestLocale} from "next-intl/server";
import {LanguageSwitcher} from "@/components/language-switcher";
import {LoginShowcase} from "@/components/login-showcase";
import {SocialAuthButtons} from "@/components/social-auth-buttons";

type HomePageProps = {
  params: Promise<{locale: string}>;
};

export default async function HomePage({params}: HomePageProps) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "HomePage"});
  const slides = [1, 2, 3, 4, 5].map((item) => ({
    title: t(`login-title-${item}`),
    text: t(`login-text-${item}`),
    image: `/images/login/login-image-${item}.jpeg`
  }));

  return (
    <div
      className="relative h-dvh overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{backgroundImage: "url('/images/login-backgorund.jpeg')"}}
    >
      <div className="absolute inset-0 bg-slate-950/30" />

      <main className="relative z-10 mx-auto grid h-full min-h-0 w-full max-w-[1024px] items-center gap-4 p-4 md:grid-cols-[5fr_4fr] md:p-5 lg:max-h-[900px] lg:gap-6 lg:p-6">
        <section className="order-2 min-h-0 md:order-1 md:h-[500px] md:min-w-0 lg:h-[560px]">
          <LoginShowcase slides={slides} />
        </section>

        <section className="liquid-card order-1 min-h-0 rounded-[2rem] p-4 sm:p-5 md:order-2 md:h-[500px] lg:h-[560px] lg:min-w-0 lg:p-6">
          <span className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] border-2 border-white/40" />
          <span className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-12px_28px_rgba(255,255,255,0.08),0_18px_40px_rgba(2,23,56,0.24)]" />
          <div className="flex w-full justify-end">
              <LanguageSwitcher />
            </div>

            <div className="mt-4 space-y-2 lg:mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">ShopIA</p>
              <h1 className="text-2xl font-semibold leading-8 tracking-tight text-white lg:text-3xl lg:leading-10">{t("loginHeading")}</h1>
              <p className="text-sm leading-6 text-slate-100 lg:text-base">{t("loginDescription")}</p>
            </div>

            <SocialAuthButtons
              locale={locale}
              googleLabel={t("socialGoogle")}
              facebookLabel={t("socialFacebook")}
              linkedInLabel={t("socialLinkedIn")}
              disclaimer={t("socialDisclaimer")}
            />
        </section>
      </main>
    </div>
  );
}
