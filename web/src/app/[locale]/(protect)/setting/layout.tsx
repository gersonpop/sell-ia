import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {EmbeddedPattern} from "@/components/module-patterns/EmbeddedPattern";
import {getSettingChildren, getSettingParent, requireProtectedSettingContext} from "./_lib";

type SettingLayoutProps = {
  params: Promise<{locale: string}>;
  children: React.ReactNode;
};

export default async function SettingLayout({params, children}: SettingLayoutProps) {
  const {locale} = await params;
  const {session, actor, modules} = await requireProtectedSettingContext(locale);
  const settingParent = getSettingParent(modules);
  const childrenModules = getSettingChildren(modules, settingParent);
  const pageContent = (settingParent?.pageContent ?? "embedded").toLowerCase();

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session.user.name ?? "Usuario"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? null}
      actorId={actor.actorId}
      actorRole={actor.role}
      companyId={actor.companyId}
      title="Configuracion"
      description="Contenido renderizado desde modules dentro de contentSidebar"
    >
      {pageContent === "embedded" ? (
        <EmbeddedPattern locale={locale} parentTitle={settingParent?.name ?? "Configuracion"} items={childrenModules}>
          {children}
        </EmbeddedPattern>
      ) : (
        children
      )}
    </ProtectedSidebarLayout>
  );
}
