import {redirect} from "next/navigation";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import {getSettingChildren, getSettingParent, requireProtectedSettingContext} from "./_lib";

type SettingsPageProps = {
  params: Promise<{locale: string}>;
};

export default async function SettingsPage({params}: SettingsPageProps) {
  const {locale} = await params;
  const {modules} = await requireProtectedSettingContext(locale);
  const settingParent = getSettingParent(modules);

  if (!settingParent) {
    return (
      <NewPagePattern title="Configuracion" description="No existe un modulo raiz activo para /setting en la tabla modules." />
    );
  }

  const children = getSettingChildren(modules, settingParent);

  if (children.length > 0) {
    redirect(`/${locale}${children[0].route}`);
  }

  return (
    <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
      <h1 className="text-2xl font-semibold">{settingParent.description || settingParent.name}</h1>
      <p className="mt-2 text-sm text-slate-500">Este modulo usa patron embedded. Selecciona un modulo hijo en el panel izquierdo.</p>
    </section>
  );
}
