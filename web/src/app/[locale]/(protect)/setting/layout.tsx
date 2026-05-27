import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {resolveLoginNavigation} from "@/server/loginAccess";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";
import {selectSidebarModulesFromDbRows} from "@/lib/sidebar-access";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {EmbeddedPattern} from "@/components/module-patterns/EmbeddedPattern";

export type SettingModule = {
  id: string;
  code: string;
  name: string;
  description: string;
  route: string;
  icon: string | null;
  parent: string;
  status: string;
  pageContent: string | null;
  sortOrder: number;
};

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toSort(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export async function requireProtectedSettingContext(locale: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/${locale}`);
  }

  const provider = ((session.user as {provider?: "google" | "facebook" | "linkedin"}).provider ?? "google");
  const navigation = await resolveLoginNavigation(session.user.email, provider);
  if (navigation.flow === "FORM_REQUIRED") redirect(`/${locale}/onboarding`);
  if (navigation.flow === "PENDING_ONLY") redirect(`/${locale}/pending-approval`);
  if (navigation.flow === "PROVIDER_CONFLICT") redirect(`/${locale}`);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, unknown>>;
  const modules: SettingModule[] = rows
    .map((row) => ({
      id: toText(row.id),
      code: toText(row.code),
      name: toText(row.name),
      description: toText(row.description),
      route: toText(row.route),
      icon: toText(row.icon) || null,
      parent: toText(row.parent),
      status: toText(row.status).toLowerCase(),
      pageContent: toText(row.page_content) || null,
      sortOrder: toSort(row.sort_order ?? row.order)
    }))
    .filter((item) => item.status === "active")
    .sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.name.localeCompare(b.name)));

  const initialSidebarModules = selectSidebarModulesFromDbRows(rows);

  return {session, actor, modules, initialSidebarModules};
}

export function getSettingParent(modules: SettingModule[]) {
  return modules.find((module) => module.parent === "/" && module.route === "/setting") ?? null;
}

export function getSettingChildren(modules: SettingModule[], parent: SettingModule | null) {
  if (!parent) return [];
  return modules.filter((module) => module.parent === parent.id);
}

type SettingLayoutProps = {
  params: Promise<{locale: string}>;
  children: React.ReactNode;
};

export default async function SettingLayout({params, children}: SettingLayoutProps) {
  const {locale} = await params;
  const {session, actor, modules, initialSidebarModules} = await requireProtectedSettingContext(locale);
  const settingParent = getSettingParent(modules);
  const childrenModules = getSettingChildren(modules, settingParent);
  const pageContent = (settingParent?.pageContent ?? "embedded").toLowerCase();

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session?.user?.name ?? "Usuario"}
      userEmail={session?.user?.email ?? ""}
      userImage={session?.user?.image ?? null}
      actorId={actor.actorId}
      actorRole={actor.role}
      companyId={actor.companyId}
      initialModules={initialSidebarModules}
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
