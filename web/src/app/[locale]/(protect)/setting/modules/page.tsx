import {getTranslations} from "next-intl/server";
import {requireProtectedSettingContext} from "../_lib";
import {ModulesConfigClient} from "./component.modules";
type SettingsModulesPageProps = {
  params: Promise<{locale: string}>;
};

export default async function SettingsModulesPage({params}: SettingsModulesPageProps) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "AccountConfig"});
  const {actor, modules} = await requireProtectedSettingContext(locale);
  const current = modules.find((item) => item.route === "/setting/modules") ?? null;
  const role = actor.role;
  const actorId = actor.actorId;
  const companyId = actor.companyId;

  return (
    <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
      <h1 id="titleNewPage" className="text-2xl font-semibold">{current?.description || current?.name || t("layoutTitle")}</h1>
      <p className="mt-2 text-sm text-slate-500">{t("layoutDescription")}</p>
      <div className="mt-4">
        {role !== "SU" ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{t("forbiddenOnlySu")}</section>
        ) : (
          <ModulesConfigClient actorId={actorId} actorRole={role} companyId={companyId} />
        )}
      </div>
    </section>
  );
}
