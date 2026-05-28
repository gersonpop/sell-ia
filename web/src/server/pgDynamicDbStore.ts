import {getPgPool} from "@/server/postgres";
import {access, mkdir, writeFile} from "node:fs/promises";
import {constants as fsConstants} from "node:fs";
import {join} from "node:path";
import {invalidateCatalogCache} from "@/server/auth/onboarding";

// Store in-memory cache for static tables
type StaticCacheEntry = {
  data: any[];
  expiresAt: number;
};
const staticStoreCache: Record<string, StaticCacheEntry> = {};
const STATIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateStoreCache(tableParam?: string) {
  if (tableParam) {
    const table = tableParam.trim().toLowerCase();
    delete staticStoreCache[table];
  } else {
    for (const key of Object.keys(staticStoreCache)) {
      delete staticStoreCache[key];
    }
  }
  // Also invalidate the onboarding catalog cache
  try {
    invalidateCatalogCache();
  } catch {
    // Ignore any import or timing issues
  }
}

export type ActorScope = "SU" | "cliente";

export type ActorContext = {
  actorId: string;
  role: ActorScope;
  companyId: string | null;
};

const TABLE_MAP = {
  modules: 'public.modules',
  users: 'public."PlatformUser"',
  oauth_sessions: 'public.oauth_sessions',
  roles: 'public."Role"',
  role_assignments: 'public."UserRole"',
  audit_logs: 'public.audit_logs',
  st_multidata: 'public."st_Multidata"',
  st_country: 'public."st_Country"',
  st_state: 'public."st_State"',
  st_city: 'public."st_City"'
} as const;

type DynamicTableName = keyof typeof TABLE_MAP;

const COMPANY_SCOPED_TABLES = new Set<DynamicTableName>(["users", "oauth_sessions", "roles", "role_assignments"]);

function normalizeTable(table: string): DynamicTableName {
  const normalized = table.trim().toLowerCase() as DynamicTableName;
  if (!(normalized in TABLE_MAP)) {
    throw new Error(`Table '${table}' is not allowed`);
  }
  return normalized;
}

function ensureSu(actor: ActorContext) {
  if (actor.role !== "SU") {
    throw new Error("Forbidden");
  }
}

function isCorsOriginAllowed(origin: string | null) {
  const allowlist = (process.env.CORS_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowlist.length === 0) {
    return true;
  }
  if (!origin) {
    return false;
  }
  return allowlist.includes(origin);
}

async function resolveCatalogStatus(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("status is required");
  const result = await getPgPool().query<{value: string}>(
    'select "value" from public."st_Multidata" where lower("value")=lower($1) and lower(coalesce("type",\'\'))=\'modulestatus\' limit 1',
    [text]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("status must exist in st_Multidata catalog");
  return result.rows[0].value;
}

async function resolvePageContent(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("content is required");
  const result = await getPgPool().query<{value: string}>(
    'select "value" from public."st_Multidata" where lower("value")=lower($1) and lower(coalesce("type",\'\'))=\'pagecontent\' limit 1',
    [text]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("content must exist in st_Multidata catalog");
  return result.rows[0].value;
}

function resolveIncomingContent(payload: Record<string, unknown>) {
  return payload.content ?? "newPage";
}

function normalizePageContentKind(value: string) {
  const v = value.trim().toLowerCase();
  if (v === "newpage" || v === "nueva pagina" || v === "nuevapagina") return "newpage";
  if (v === "embedded" || v === "embebido") return "embedded";
  return v;
}

async function validateRoleScope(scopeId: string) {
  const result = await getPgPool().query<{type: string | null; typeUse: string | null; value: string | null; name: string | null}>(
    'select "type", "typeUse", "value", "name" from public."st_Multidata" where lower("Initials_PK")=lower($1) limit 1',
    [scopeId]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("scope_id not found in st_Multidata");
  const row = result.rows[0];
  const marker = `${row.type ?? ""} ${row.typeUse ?? ""} ${row.value ?? ""} ${row.name ?? ""}`.toLowerCase();
  if (!marker.includes("rolescope")) throw new Error("scope_id must belong to roleScope");
}

async function validateModuleParent(parent: string | null) {
  if (!parent || parent.trim().length === 0) {
    throw new Error("parent is required. Use '/' for root");
  }
  if (parent === "/") return;
  const result = await getPgPool().query("select id from public.modules where id=$1 limit 1", [parent]);
  if ((result.rowCount ?? 0) === 0) throw new Error("parent module not found");
}

async function generateModuleCode(name: string) {
  const seed = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "MODULE";
  const existing = await getPgPool().query<{code: string}>("select code from public.modules where code like $1", [`${seed}%`]);
  if ((existing.rowCount ?? 0) === 0) return seed;
  const used = new Set(existing.rows.map((row) => row.code));
  let i = 2;
  while (used.has(`${seed}_${i}`)) i += 1;
  return `${seed}_${i}`;
}

function normalizeModuleRoutePath(route: string | null) {
  if (!route) return null;
  const trimmed = route.trim();
  if (!trimmed.startsWith("/")) return null;
  const clean = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) return null;
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (!/^[a-zA-Z0-9-_]+$/.test(segment)) return null;
  }
  return segments;
}

async function resolveParentAwareRoute(route: string | null, parentId: string | null) {
  const currentSegments = normalizeModuleRoutePath(route);
  if (!currentSegments) return route ? route.trim() : null;
  if (!parentId || parentId === "/") {
    return `/${currentSegments.join("/")}`;
  }

  const parentResult = await getPgPool().query<{route: string | null}>("select route from public.modules where id=$1 limit 1", [parentId]);
  if ((parentResult.rowCount ?? 0) === 0) {
    throw new Error("parent module not found");
  }

  const parentRoute = parentResult.rows[0].route;
  const parentSegments = normalizeModuleRoutePath(parentRoute);
  if (!parentSegments) {
    return `/${currentSegments.join("/")}`;
  }

  const isAlreadyNested = currentSegments.length >= parentSegments.length && parentSegments.every((segment, index) => currentSegments[index] === segment);
  if (isAlreadyNested) {
    return `/${currentSegments.join("/")}`;
  }

  const tailSegments = [...currentSegments];
  if (tailSegments.length === 1 && parentSegments.at(-1) === tailSegments[0]) {
    return `/${parentSegments.join("/")}`;
  }
  return `/${[...parentSegments, ...tailSegments].join("/")}`;
}

function getLeafTitle(segments: string[]) {
  return segments.at(-1)?.replace(/[-_]/g, " ") ?? "module";
}

async function ensureModuleRouteScaffold(route: string | null, pageContent: string) {
  const segments = normalizeModuleRoutePath(route);
  if (!segments) return;
  const routeDir = join(process.cwd(), "src", "app", "[locale]", "(protect)", ...segments);

  await mkdir(routeDir, {recursive: true});
  const pageTitle = getLeafTitle(segments);
  const normalized = normalizePageContentKind(pageContent);
  const baseName = segments[segments.length - 1].toLowerCase();

  if (normalized === "embedded") {
    const layoutFile = join(routeDir, "layout.tsx");
    const pageFile = join(routeDir, "page.tsx");

    const layoutContent = `import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";
import {selectSidebarModulesFromDbRows} from "@/lib/sidebar-access";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {EmbeddedPattern} from "@/components/module-patterns/EmbeddedPattern";

type LayoutProps = {
  params: Promise<{locale: string}>;
  children: React.ReactNode;
};

export default async function DynamicEmbeddedLayout({params, children}: LayoutProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const initialSidebarModules = selectSidebarModulesFromDbRows(rows);

  const currentRoute = "${route}";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");
  const childrenModules = rows
    .filter(m => m.parent === currentModule?.id && m.status === "active")
    .map(row => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description ?? ""),
      route: String(row.route),
      icon: String(row.icon || "") || null,
      parent: String(row.parent),
      status: String(row.status),
      pageContent: String(row.page_content || row.pageContent || ""),
      sortOrder: Number(row.sort_order ?? row.sortOrder ?? 100)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
      title={currentModule?.name ?? "${pageTitle}"}
      description={currentModule?.description ?? ""}
    >
      <EmbeddedPattern locale={locale} parentTitle={currentModule?.name ?? "${pageTitle}"} items={childrenModules}>
        {children}
      </EmbeddedPattern>
    </ProtectedSidebarLayout>
  );
}`;

    const pageContentTemplate = `import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicEmbeddedPage({params}: PageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const currentRoute = "${route}";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");
  const childrenModules = rows
    .filter(m => m.parent === currentModule?.id && m.status === "active")
    .sort((a, b) => Number(a.sort_order ?? a.sortOrder ?? 100) - Number(b.sort_order ?? b.sortOrder ?? 100));

  if (childrenModules.length > 0) {
    redirect("/" + locale + childrenModules[0].route);
  }

  return (
    <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
      <h1 className="text-2xl font-semibold">{currentModule?.description || currentModule?.name || "${pageTitle}"}</h1>
      <p className="mt-2 text-sm text-slate-500">Módulo embebido. Agrega submódulos hijos para ver el contenido.</p>
    </section>
  );
}`;

    await writeFile(layoutFile, layoutContent, "utf8");
    await writeFile(pageFile, pageContentTemplate, "utf8");
    return;
  }

  if (normalized === "newpage") {
    const pageFile = join(routeDir, "page.tsx");
    const componentFile = join(routeDir, `component.${baseName}.tsx`);

    const isRootModule = segments.length === 1;

    let pageTemplate = "";
    if (isRootModule) {
      pageTemplate = `import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";
import {selectSidebarModulesFromDbRows} from "@/lib/sidebar-access";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.${baseName}";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const initialSidebarModules = selectSidebarModulesFromDbRows(rows);

  const currentRoute = "${route}";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");

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
      title={currentModule?.name ?? "${pageTitle}"}
      description={currentModule?.description ?? ""}
    >
      <NewPagePattern
        title={currentModule?.name ?? "${pageTitle}"}
        description={currentModule?.description ?? ""}
      >
        <DynamicComponent />
      </NewPagePattern>
    </ProtectedSidebarLayout>
  );
}`;
    } else {
      pageTemplate = `import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.${baseName}";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  return (
    <NewPagePattern
      title="${pageTitle}"
      description="${pageTitle}"
    >
      <DynamicComponent />
    </NewPagePattern>
  );
}`;
    }

    const componentTemplate = `"use client";

export function DynamicComponent() {
  return (
    <section className="space-y-4">
      <p className="text-sm text-slate-600">Este módulo se ha creado dinámicamente con contenido básico.</p>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <h2 className="text-base font-semibold text-slate-800">Contenido básico</h2>
        <p className="mt-1 text-xs text-slate-500">Puedes editar este componente en \`component.${baseName}.tsx\` para agregar tu lógica de negocio.</p>
      </div>
    </section>
  );
}

export default DynamicComponent;`;

    await writeFile(pageFile, pageTemplate, "utf8");

    try {
      await access(componentFile, fsConstants.F_OK);
    } catch {
      await writeFile(componentFile, componentTemplate, "utf8");
    }
    return;
  }
}

async function createModuleRecord(actor: ActorContext, payload: Record<string, unknown>) {
  ensureSu(actor);
  const name = String(payload.name ?? "").trim();
  const scopeId = String(payload.scope_id ?? "").trim();
  const sortOrder = Number(payload.sort_order ?? 100);
  if (!name || !scopeId || !Number.isFinite(sortOrder)) throw new Error("name, scope_id and sort_order are required");
  const status = await resolveCatalogStatus(payload.status);
  const pageContent = await resolvePageContent(resolveIncomingContent(payload));
  const parent = payload.parent !== undefined ? String(payload.parent).trim() : "";
  await validateRoleScope(scopeId);
  await validateModuleParent(parent);
  const effectiveRoute = await resolveParentAwareRoute(payload.route ? String(payload.route) : null, parent);
  const code = await generateModuleCode(name);
  const result = await getPgPool().query(
    "insert into public.modules (code,name,description,route,icon,sort_order,status,parent,scope_id,content) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *",
    [code, name, payload.description ? String(payload.description) : null, effectiveRoute, payload.icon ? String(payload.icon) : null, sortOrder, status, parent, scopeId, pageContent]
  );
  await ensureModuleRouteScaffold(effectiveRoute, pageContent);
  return result.rows[0];
}

async function updateModuleRecord(actor: ActorContext, id: string, patch: Record<string, unknown>) {
  ensureSu(actor);
  const current = await getPgPool().query<Record<string, unknown>>("select * from public.modules where id=$1 limit 1", [id]);
  if ((current.rowCount ?? 0) === 0) throw new Error("Record not found");
  if (patch.code && String(patch.code).trim().toUpperCase() !== String(current.rows[0].code ?? "")) throw new Error("code is immutable");
  const next = {
    name: patch.name ? String(patch.name).trim() : String(current.rows[0].name ?? ""),
    description: patch.description !== undefined ? (patch.description ? String(patch.description) : null) : (current.rows[0].description as string | null),
    route: patch.route !== undefined ? (patch.route ? String(patch.route) : null) : (current.rows[0].route as string | null),
    icon: patch.icon !== undefined ? (patch.icon ? String(patch.icon) : null) : (current.rows[0].icon as string | null),
    sort_order: patch.sort_order !== undefined ? Number(patch.sort_order) : Number(current.rows[0].sort_order ?? 100),
    status: patch.status !== undefined ? await resolveCatalogStatus(patch.status) : await resolveCatalogStatus(current.rows[0].status),
    content:
      patch.content !== undefined
        ? await resolvePageContent(resolveIncomingContent(patch))
        : await resolvePageContent(current.rows[0].content ?? "newPage"),
    parent: patch.parent !== undefined ? String(patch.parent).trim() : String(current.rows[0].parent ?? "/"),
    scope_id: patch.scope_id !== undefined ? String(patch.scope_id) : String(current.rows[0].scope_id ?? "")
  };
  if (!Number.isFinite(next.sort_order)) throw new Error("sort_order must be numeric");
  await validateRoleScope(next.scope_id);
  await validateModuleParent(next.parent);
  const effectiveRoute = await resolveParentAwareRoute(next.route, next.parent);
  const updated = await getPgPool().query(
    "update public.modules set name=$1, description=$2, route=$3, icon=$4, sort_order=$5, status=$6, parent=$7, scope_id=$8, content=$9, updated_at=now() where id=$10 returning *",
    [next.name, next.description, effectiveRoute, next.icon, next.sort_order, next.status, next.parent, next.scope_id, next.content, id]
  );
  await ensureModuleRouteScaffold(effectiveRoute, next.content);
  return updated.rows[0];
}

async function softDeleteModuleRecord(actor: ActorContext, id: string) {
  ensureSu(actor);
  const inactive = await resolveCatalogStatus("inactive");
  const updated = await getPgPool().query("update public.modules set status=$1, updated_at=now() where id=$2 returning *", [inactive, id]);
  if ((updated.rowCount ?? 0) === 0) throw new Error("Record not found");
}

function sanitizeMultidataText(value: unknown) {
  return String(value ?? "").trim();
}

async function createStMultidataRecord(actor: ActorContext, payload: Record<string, unknown>) {
  ensureSu(actor);
  const initialsPk = sanitizeMultidataText(payload.Initials_PK);
  const name = sanitizeMultidataText(payload.name);
  const value = sanitizeMultidataText(payload.value);
  const type = sanitizeMultidataText(payload.type);
  const typeDescription = sanitizeMultidataText(payload.typeDescription) || null;
  const typeUse = sanitizeMultidataText(payload.typeUse) || null;

  if (!initialsPk || !name || !value || !type) {
    throw new Error("Initials_PK, name, value and type are required");
  }

  const result = await getPgPool().query(
    'insert into public."st_Multidata" ("Initials_PK", name, value, type, "typeDescription", "typeUse", created_at, updated_at) values ($1,$2,$3,$4,$5,$6,now(),now()) returning "Initials_PK", name, value, type, "typeDescription", "typeUse", created_at, updated_at',
    [initialsPk, name, value, type, typeDescription, typeUse]
  );

  return result.rows[0];
}

async function updateStMultidataRecord(actor: ActorContext, valueId: string, patch: Record<string, unknown>) {
  ensureSu(actor);
  const current = await getPgPool().query(
    'select "Initials_PK", name, value, type, "typeDescription", "typeUse" from public."st_Multidata" where value=$1 limit 1',
    [valueId]
  );
  if ((current.rowCount ?? 0) === 0) throw new Error("Record not found");

  const row = current.rows[0] as Record<string, unknown>;
  const initialsPk = patch.Initials_PK !== undefined ? sanitizeMultidataText(patch.Initials_PK) : sanitizeMultidataText(row.Initials_PK);
  const name = patch.name !== undefined ? sanitizeMultidataText(patch.name) : sanitizeMultidataText(row.name);
  const value = patch.value !== undefined ? sanitizeMultidataText(patch.value) : sanitizeMultidataText(row.value);
  const type = patch.type !== undefined ? sanitizeMultidataText(patch.type) : sanitizeMultidataText(row.type);
  const typeDescription = patch.typeDescription !== undefined ? (sanitizeMultidataText(patch.typeDescription) || null) : (row.typeDescription ? String(row.typeDescription) : null);
  const typeUse = patch.typeUse !== undefined ? (sanitizeMultidataText(patch.typeUse) || null) : (row.typeUse ? String(row.typeUse) : null);

  if (!initialsPk || !name || !value || !type) {
    throw new Error("Initials_PK, name, value and type are required");
  }

  const result = await getPgPool().query(
    'update public."st_Multidata" set "Initials_PK"=$1, name=$2, value=$3, type=$4, "typeDescription"=$5, "typeUse"=$6, updated_at=now() where value=$7 returning "Initials_PK", name, value, type, "typeDescription", "typeUse", created_at, updated_at',
    [initialsPk, name, value, type, typeDescription, typeUse, valueId]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("Record not found");
  return result.rows[0];
}

async function deleteStMultidataRecord(actor: ActorContext, valueId: string) {
  ensureSu(actor);
  const result = await getPgPool().query('delete from public."st_Multidata" where value=$1 returning value', [valueId]);
  if ((result.rowCount ?? 0) === 0) throw new Error("Record not found");
}

async function appendAuditDeny(actor: ActorContext, table: string, reason: string) {
  try {
    await getPgPool().query(
      "insert into public.audit_logs (actor_id, actor_role, table_name, action, reason, company_id, created_at) values ($1,$2,$3,$4,$5,$6,now())",
      [actor.actorId, actor.role, table, "deny", reason, actor.companyId]
    );
  } catch {
    return;
  }
}

export async function listActiveModulesForRole(role: ActorScope) {
  const rows = await getPgPool().query<{id: string; code: string; name: string; route: string | null; icon: string | null; scope_value: string | null; scope_name: string | null}>(
    'select m.id, m.code, m.name, m.route, m.icon, lower(coalesce(s."value",\'\')) as scope_value, lower(coalesce(s."name",\'\')) as scope_name from public.modules m join public."st_Multidata" s on lower(s."Initials_PK") = lower(m.scope_id) where lower(m.status)=\'active\' order by m.sort_order asc, m.name asc'
  );
  return rows.rows.filter((row) => {
    const marker = `${row.scope_value ?? ""} ${row.scope_name ?? ""}`;
    if (marker.includes("su") && !marker.includes("client")) return role === "SU";
    return true;
  }).map((row) => ({id: row.id, code: row.code, name: row.name, route: row.route, icon: row.icon}));
}

const PK_MAP = {
  modules: 'id',
  users: 'id_user_pk',
  oauth_sessions: 'id',
  roles: 'id',
  role_assignments: 'id',
  audit_logs: 'id',
  st_multidata: 'value',
  st_country: 'iso',
  st_state: 'id_state',
  st_city: 'id_city'
} as const;

async function createPlatformUserRecord(actor: ActorContext, payload: Record<string, unknown>) {
  ensureSu(actor);
  const email = String(payload.user_email || payload.email || "").trim().toLowerCase();
  const name = String(payload.name || payload.firstName || "").trim();
  const lastName = String(payload.last_name || payload.lastName || "").trim();
  const phone = String(payload.phone_number || payload.phone || "").trim();
  const companyId = payload.companyId ? String(payload.companyId).trim() : (actor.role !== "SU" ? actor.companyId : "900000000");
  const countryCode = String(payload.country_code || "+57").trim();
  const countryIso = String(payload.country_iso || "CO").trim();
  const status = String(payload.status || "active").trim();
  const provider = String(payload.provider || "google").trim();
  
  if (!email || !name) throw new Error("user_email and name are required");
  
  const id = `USR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const username = email;
  
  const result = await getPgPool().query(
    `INSERT INTO public."PlatformUser" (
      id_user_pk, user_email, username, name, last_name, phone_number, "companyId", 
      country_code, country_iso, dni, birth_date, gender, status, provider, avatar, position, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now(),now()) returning *`,
    [
      id, email, username, name, lastName, phone, companyId,
      countryCode, countryIso, payload.dni ? String(payload.dni) : null,
      payload.birth_date ? new Date(String(payload.birth_date)) : null,
      payload.gender ? String(payload.gender) : null,
      status, provider, payload.avatar ? String(payload.avatar) : null,
      payload.position ? String(payload.position) : null
    ]
  );
  return result.rows[0];
}

async function updatePlatformUserRecord(actor: ActorContext, id: string, patch: Record<string, unknown>) {
  ensureSu(actor);
  const current = await getPgPool().query('SELECT * FROM public."PlatformUser" WHERE id_user_pk=$1 LIMIT 1', [id]);
  if ((current.rowCount ?? 0) === 0) throw new Error("User not found");

  const row = current.rows[0];
  const email = patch.user_email !== undefined ? String(patch.user_email).trim().toLowerCase() : row.user_email;
  const name = patch.name !== undefined ? String(patch.name).trim() : row.name;
  const lastName = patch.last_name !== undefined ? String(patch.last_name).trim() : row.last_name;
  const phone = patch.phone_number !== undefined ? String(patch.phone_number).trim() : row.phone_number;
  const companyId = patch.companyId !== undefined ? String(patch.companyId).trim() : row.companyId;
  const countryCode = patch.country_code !== undefined ? String(patch.country_code).trim() : row.country_code;
  const countryIso = patch.country_iso !== undefined ? String(patch.country_iso).trim() : row.country_iso;
  const status = patch.status !== undefined ? String(patch.status).trim() : row.status;
  const provider = patch.provider !== undefined ? String(patch.provider).trim() : row.provider;
  const dni = patch.dni !== undefined ? (patch.dni ? String(patch.dni) : null) : row.dni;
  const birthDate = patch.birth_date !== undefined ? (patch.birth_date ? new Date(String(patch.birth_date)) : null) : row.birth_date;
  const gender = patch.gender !== undefined ? (patch.gender ? String(patch.gender) : null) : row.gender;
  const avatar = patch.avatar !== undefined ? (patch.avatar ? String(patch.avatar) : null) : row.avatar;
  const position = patch.position !== undefined ? (patch.position ? String(patch.position) : null) : row.position;

  const result = await getPgPool().query(
    `UPDATE public."PlatformUser" SET 
      user_email=$1, username=$2, name=$3, last_name=$4, phone_number=$5, "companyId"=$6, 
      country_code=$7, country_iso=$8, dni=$9, birth_date=$10, gender=$11, status=$12, 
      provider=$13, avatar=$14, position=$15, updated_at=now() 
     WHERE id_user_pk=$16 returning *`,
    [
      email, email, name, lastName, phone, companyId,
      countryCode, countryIso, dni, birthDate, gender, status,
      provider, avatar, position, id
    ]
  );
  return result.rows[0];
}

async function deletePlatformUserRecord(actor: ActorContext, id: string) {
  ensureSu(actor);
  const result = await getPgPool().query('DELETE FROM public."PlatformUser" WHERE id_user_pk=$1 RETURNING id_user_pk', [id]);
  if ((result.rowCount ?? 0) === 0) throw new Error("User not found");
}

async function createRoleRecord(actor: ActorContext, payload: Record<string, unknown>) {
  const name = String(payload.name || "").trim();
  const key = String(payload.key_id || payload.key || "").trim().toUpperCase().slice(0, 5);
  const description = String(payload.description || "").trim();
  const scope = String(payload.scope || "user").trim();
  const companyId = actor.role !== "SU" ? actor.companyId : String(payload.company_id || payload.companyId || "900000000").trim();
  
  if (!name || !key) throw new Error("name and key_id are required");
  
  const id = `ROL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  await getPgPool().query(
    'insert into public."Role" (id, "companyId", name, key, description, scope, "createdAt", "updatedAt") values ($1, $2, $3, $4, $5, $6, now(), now())',
    [id, companyId, name, key, description, scope]
  );
  
  return {
    id,
    key_id: key,
    name,
    description,
    scope,
    company_id: companyId,
    status: "active",
    permissions: {}
  };
}

async function updateRoleRecord(actor: ActorContext, id: string, patch: Record<string, unknown>) {
  const name = patch.name !== undefined ? String(patch.name).trim() : null;
  const description = patch.description !== undefined ? String(patch.description).trim() : null;
  const scope = patch.scope !== undefined ? String(patch.scope).trim() : null;
  
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (name !== null) {
    updates.push(`name=$${idx++}`);
    values.push(name);
  }
  if (description !== null) {
    updates.push(`description=$${idx++}`);
    values.push(description);
  }
  if (scope !== null) {
    updates.push(`scope=$${idx++}`);
    values.push(scope);
  }
  
  if (updates.length > 0) {
    values.push(id);
    await getPgPool().query(
      `update public."Role" set ${updates.join(", ")}, "updatedAt"=now() where id=$${idx}`,
      values
    );
  }
  
  const permissions = patch.permissions as Record<string, any> | undefined;
  if (permissions) {
    for (const [moduleId, perm] of Object.entries(permissions)) {
      const canRead = !!perm.read;
      const canCreate = !!perm.create;
      const canUpdate = !!perm.update;
      const canDelete = !!perm.delete;
      const actions = perm.microroles || {};
      
      const existing = await getPgPool().query(
        'select id from public."RolePermission" where "roleId"=$1 and "moduleId"=$2',
        [id, moduleId]
      );
      
      if (existing.rows.length > 0) {
        await getPgPool().query(
          'update public."RolePermission" set "canRead"=$1, "canCreate"=$2, "canUpdate"=$3, "canDelete"=$4, actions=$5 where id=$6',
          [canRead, canCreate, canUpdate, canDelete, JSON.stringify(actions), existing.rows[0].id]
        );
      } else {
        const permId = `RPM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        await getPgPool().query(
          'insert into public."RolePermission" (id, "roleId", "moduleId", "canRead", "canCreate", "canUpdate", "canDelete", actions) values ($1, $2, $3, $4, $5, $6, $7, $8)',
          [permId, id, moduleId, canRead, canCreate, canUpdate, canDelete, JSON.stringify(actions)]
        );
      }
    }
  }
  
  return { id, ok: true };
}

async function deleteRoleRecord(actor: ActorContext, id: string) {
  const assigned = await getPgPool().query(
    'select id from public."UserRole" where "roleId"=$1 limit 1',
    [id]
  );
  if (assigned.rows.length > 0) {
    throw new Error("No se puede eliminar el rol porque tiene usuarios asignados.");
  }
  await getPgPool().query('delete from public."RolePermission" where "roleId"=$1', [id]);
  await getPgPool().query('delete from public."Role" where id=$1', [id]);
}

export async function listRecords(actor: ActorContext, tableParam: string, id: string | null) {
  const table = normalizeTable(tableParam);

  const isStaticTable = ["modules", "st_multidata", "st_country", "st_state", "st_city"].includes(table);
  if (isStaticTable && !id) {
    const cached = staticStoreCache[table];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  if (table === "roles") {
    let query = 'select * from public."Role"';
    const values: string[] = [];
    if (id) {
      query += ' where id=$1';
      values.push(id);
      if (actor.role !== "SU") {
        if (!actor.companyId) throw new Error("companyId is required");
        query += ' and "companyId"=$2';
        values.push(actor.companyId);
      }
    } else if (actor.role !== "SU") {
      if (!actor.companyId) throw new Error("companyId is required");
      query += ' where "companyId"=$1';
      values.push(actor.companyId);
    }
    query += ' order by name asc';
    const roleRows = await getPgPool().query(query, values);
    
    const rolesList = [];
    for (const r of roleRows.rows) {
      const permRows = await getPgPool().query('select * from public."RolePermission" where "roleId"=$1', [r.id]);
      
      const permissionsMap: Record<string, any> = {};
      for (const p of permRows.rows) {
        permissionsMap[p.moduleId] = {
          read: p.canRead,
          create: p.canCreate,
          update: p.canUpdate,
          delete: p.canDelete,
          microroles: p.actions || {}
        };
      }
      
      rolesList.push({
        id: r.id,
        key_id: r.key,
        name: r.name,
        description: r.description,
        scope: r.scope,
        company_id: r.companyId,
        status: "active",
        permissions: permissionsMap
      });
    }
    return rolesList;
  }

  if (table === "modules") {
    if (id) {
      const one = await getPgPool().query("select * from public.modules where id=$1", [id]);
      return one.rows;
    }
    const all = await getPgPool().query("select * from public.modules order by sort_order asc, name asc");
    staticStoreCache["modules"] = {
      data: all.rows,
      expiresAt: Date.now() + STATIC_CACHE_TTL_MS
    };
    return all.rows;
  }
  if (table === "st_multidata") {
    if (id) {
      const one = await getPgPool().query('select "Initials_PK" as "Initials_PK", "name", "value", "type", "typeDescription", "typeUse", "created_at", "updated_at" from public."st_Multidata" where value=$1', [id]);
      return one.rows;
    }
    const all = await getPgPool().query('select "Initials_PK" as "Initials_PK", "name", "value", "type", "typeDescription", "typeUse", "created_at", "updated_at" from public."st_Multidata"');
    staticStoreCache["st_multidata"] = {
      data: all.rows,
      expiresAt: Date.now() + STATIC_CACHE_TTL_MS
    };
    return all.rows;
  }

  const dbTable = TABLE_MAP[table];
  let query = `select * from ${dbTable}`;
  const values: string[] = [];
  const pkColumn = PK_MAP[table] || 'id';

  if (id) {
    query += ` where "${pkColumn}"=$1`;
    values.push(id);
  }
  if (actor.role !== "SU" && COMPANY_SCOPED_TABLES.has(table)) {
    if (!actor.companyId) throw new Error("companyId is required for non-SU actors");
    const companyCol = (table === "users") ? '"companyId"' : 'companyid';
    query += id ? ` and ${companyCol}=$2` : ` where ${companyCol}=$1`;
    values.push(actor.companyId);
  }
  const result = await getPgPool().query(query, values);

  if (isStaticTable && !id) {
    staticStoreCache[table] = {
      data: result.rows,
      expiresAt: Date.now() + STATIC_CACHE_TTL_MS
    };
  }
  return result.rows;
}

export async function createRecord(actor: ActorContext, tableParam: string, payload: Record<string, unknown>) {
  const table = normalizeTable(tableParam);
  if (["modules", "st_multidata", "st_country", "st_state", "st_city"].includes(table)) {
    invalidateStoreCache(table);
  }
  if (table === "modules") return createModuleRecord(actor, payload);
  if (table === "st_multidata") return createStMultidataRecord(actor, payload);
  if (table === "users") return createPlatformUserRecord(actor, payload);
  if (table === "roles") return createRoleRecord(actor, payload);
  ensureSu(actor);
  throw new Error(`Create is not enabled for table '${table}'`);
}

export async function updateRecord(actor: ActorContext, tableParam: string, id: string, patch: Record<string, unknown>) {
  const table = normalizeTable(tableParam);
  if (["modules", "st_multidata", "st_country", "st_state", "st_city"].includes(table)) {
    invalidateStoreCache(table);
  }
  if (table === "modules") return updateModuleRecord(actor, id, patch);
  if (table === "st_multidata") return updateStMultidataRecord(actor, id, patch);
  if (table === "users") return updatePlatformUserRecord(actor, id, patch);
  if (table === "roles") return updateRoleRecord(actor, id, patch);
  ensureSu(actor);
  throw new Error(`Update is not enabled for table '${table}'`);
}

export async function deleteRecord(actor: ActorContext, tableParam: string, id: string) {
  const table = normalizeTable(tableParam);
  if (["modules", "st_multidata", "st_country", "st_state", "st_city"].includes(table)) {
    invalidateStoreCache(table);
  }
  if (table === "modules") {
    await softDeleteModuleRecord(actor, id);
    return;
  }
  if (table === "st_multidata") {
    await deleteStMultidataRecord(actor, id);
    return;
  }
  if (table === "users") {
    await deletePlatformUserRecord(actor, id);
    return;
  }
  if (table === "roles") {
    await deleteRoleRecord(actor, id);
    return;
  }
  ensureSu(actor);
  throw new Error(`Delete is not enabled for table '${table}'`);
}

export {isCorsOriginAllowed};

export async function auditDenied(actor: ActorContext, table: string, reason: string) {
  await appendAuditDeny(actor, table, reason);
}
