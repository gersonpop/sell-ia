import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {authOptions} from "@/lib/auth-options";
import {listPendingApprovals} from "@/server/auth/onboarding";
import {PendingUsersClient} from "./PendingUsersClient";

type PendingUsersPageProps = {
  params: Promise<{locale: string}>;
};

export default async function PendingUsersPage({params}: PendingUsersPageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/${locale}`);
  }

  const pending = await listPendingApprovals();
  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session.user.name ?? "Usuario"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? null}
      actorId={session.user.email ?? session.user.name ?? "anonymous"}
      actorRole={role}
      companyId={(session.user as {companyId?: string | null}).companyId ?? null}
      title="Pendientes de alta"
      description="Revision y aprobacion de usuarios registrados por redes sociales."
    >
      <PendingUsersClient initialPending={pending} />
    </ProtectedSidebarLayout>
  );
}
