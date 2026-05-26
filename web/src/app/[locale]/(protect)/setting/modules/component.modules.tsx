"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import Image from "next/image";
import {useTranslations} from "next-intl";
import {useRouter} from "next/navigation";

type ModuleItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  route: string | null;
  icon: string | null;
  sort_order: number;
  status: "active" | "inactive";
  parent: string | null;
  scope_id: string;
  content?: string | null;
  updated_at?: string | null;
};

type ScopeItem = {id: string; value?: string; name?: string};
type StatusItem = {value: string; label: string};
type PageContentItem = {value: string; label: string};
type ScopeCatalogItem = ScopeItem & {
  type?: string;
  typeuse?: string;
  typeUse?: string;
  type_description?: string;
  typeDescription?: string;
  Initials_PK?: string;
  initials_pk?: string;
};

function normalizeScopeItem(item: ScopeCatalogItem): ScopeItem | null {
  const idCandidate = item.Initials_PK ?? item.initials_pk ?? item.id;
  const id = typeof idCandidate === "string" ? idCandidate.trim() : "";
  if (!id) return null;
  const value = typeof item.value === "string" ? item.value : undefined;
  const name = typeof item.name === "string" ? item.name : undefined;
  return {id, value, name};
}

function isRoleScope(item: ScopeCatalogItem) {
  const marker = Object.values(item)
    .map((value) => String(value ?? "").toLowerCase().replace(/[_\s-]+/g, ""))
    .join(" ");
  return marker.includes("rolescope") || marker.includes("alcancedelrol");
}

type Props = {
  actorId: string;
  actorRole: "SU" | "cliente";
  companyId: string | null;
};

const DEFAULT_VISIBLE_COLUMNS = ["code", "name", "route", "status", "updated_at", "actions"] as const;

const defaultForm = {
  code: "",
  name: "",
  description: "",
  route: "",
  icon: "",
  sort_order: "100",
  status: "",
  parent: "/",
  scope_id: "",
  content: "newPage"
};

export function ModulesConfigClient({actorId, actorRole, companyId}: Props) {
  const t = useTranslations("AccountConfig");
  const router = useRouter();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [pageContents, setPageContents] = useState<PageContentItem[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"code" | "name" | "status" | "updated_at">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_COLUMNS));
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDrawerVisible, setFormDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof typeof defaultForm, string>>>({});

  const pageSize = rowsPerPage;

  const headers = useMemo(
    () => ({
      Authorization: "Bearer local-dev-token",
      "x-oauth-session": "active",
      "x-actor-id": actorId,
      "x-actor-role": actorRole,
      "x-company-id": companyId ?? "",
      "content-type": "application/json"
    }),
    [actorId, actorRole, companyId]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [modulesRes, scopesRes] = await Promise.all([
        fetch("/api/v1/db/modules", {headers}),
        fetch("/api/v1/db/st_multidata", {headers})
      ]);
      const modulesBody = await modulesRes.json();
      const scopesBody = await scopesRes.json();
      if (!modulesRes.ok) throw new Error(modulesBody.message ?? t("errors.loadModules"));
      if (!scopesRes.ok) throw new Error(scopesBody.message ?? t("errors.loadScopes"));
      setModules((modulesBody.data ?? []) as ModuleItem[]);
      const rawScopes = (scopesBody.data ?? []) as ScopeCatalogItem[];
      const roleScopes = rawScopes.filter(isRoleScope).map(normalizeScopeItem).filter((item): item is ScopeItem => item !== null);
      setScopes(roleScopes);
      const statusOptions = rawScopes
        .filter((item) => String(item.type ?? "").toLowerCase() === "modulestatus")
        .map((item) => ({
          value: String(item.value ?? "").trim(),
          label: String(item.name ?? item.value ?? "").trim()
        }))
        .filter((item) => item.value.length > 0);
      const dedupStatuses = Array.from(new Map(statusOptions.map((item) => [item.value.toLowerCase(), item])).values());
      setStatuses(dedupStatuses);
      const pageContentOptions = rawScopes
        .filter((item) => String(item.type ?? "").toLowerCase() === "pagecontent")
        .map((item) => ({
          value: String(item.value ?? "").trim(),
          label: String(item.name ?? item.value ?? "").trim()
        }))
        .filter((item) => item.value.length > 0);
      const dedupPageContent = Array.from(new Map(pageContentOptions.map((item) => [item.value.toLowerCase(), item])).values());
      setPageContents(dedupPageContent);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [headers, t]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) {
        await loadData();
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [success]);

  useEffect(() => {
    const closeMenu = () => {
      setOpenRowMenu(null);
      setShowColumnsMenu(false);
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const visibleModules = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = modules.filter((item) => {
      const textMatch =
        term.length === 0 ||
        [item.code, item.name, item.route ?? "", item.description ?? ""].join(" ").toLowerCase().includes(term);
      const statusMatch = statusFilter === "all" || item.status === statusFilter;
      const scopeMatch = scopeFilter === "all" || item.scope_id === scopeFilter;
      return textMatch && statusMatch && scopeMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      const left = String(a[sortBy] ?? "").toLowerCase();
      const right = String(b[sortBy] ?? "").toLowerCase();
      if (left === right) return 0;
      const comparison = left > right ? 1 : -1;
      return sortDir === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [modules, search, statusFilter, scopeFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visibleModules.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedModules = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleModules.slice(start, start + pageSize);
  }, [safePage, visibleModules, pageSize]);

  const tableColumns = useMemo(
    () => [
      {key: "code", label: t("table.code")},
      {key: "name", label: t("table.name")},
      {key: "route", label: t("table.route")},
      {key: "status", label: t("table.status")},
      {key: "updated_at", label: t("table.updatedAt")},
      {key: "actions", label: t("table.actions")}
    ],
    [t]
  );
  const headerColumns = useMemo(() => tableColumns.filter((column) => visibleColumns.has(column.key)), [tableColumns, visibleColumns]);

  function toggleColumn(columnKey: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        if (next.size === 1) return prev;
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  }

  function clearFormState() {
    setForm((current) => ({
      ...defaultForm,
      status: statuses.find((item) => item.value.toLowerCase() === "active")?.value ?? statuses[0]?.value ?? current.status
    }));
    setEditingId(null);
    setIconPreview(null);
    setFormErrors({});
  }

  function openCreateForm() {
    clearFormState();
    setIsFormOpen(true);
    window.setTimeout(() => setFormDrawerVisible(true), 10);
  }

  function onEdit(item: ModuleItem) {
    setIsFormOpen(true);
    window.setTimeout(() => setFormDrawerVisible(true), 10);
    setEditingId(item.id);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      route: item.route ?? "",
      icon: item.icon ?? "",
      sort_order: String(item.sort_order),
      status: item.status,
      parent: item.parent ?? "/",
      scope_id: item.scope_id,
      content: item.content ?? "newPage"
    });
    setIconPreview(item.icon ?? null);
    setFormErrors({});
  }

  function closeFormDrawer() {
    setFormDrawerVisible(false);
    window.setTimeout(() => setIsFormOpen(false), 220);
  }

  async function onIconFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((state) => ({...state, icon: result}));
      setIconPreview(result || null);
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit() {
    const errors: Partial<Record<keyof typeof defaultForm, string>> = {};
    if (!form.name.trim()) errors.name = t("errors.requiredName");
    if (!form.scope_id.trim()) errors.scope_id = t("errors.requiredScope");
    if (!form.sort_order.trim() || Number.isNaN(Number(form.sort_order))) {
      errors.sort_order = t("errors.numericOrder");
    }
    if (!form.status.trim()) errors.status = t("errors.requiredStatus");
    if (!form.parent.trim()) errors.parent = "parent es obligatorio. Usa '/' para raiz";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        sort_order: Number(form.sort_order),
        parent: form.parent,
        description: form.description || null,
        route: form.route || null,
        icon: form.icon || null
      };
      if (!editingId) {
        delete (payload as {code?: string}).code;
      }
      const response = await fetch("/api/v1/db/modules", {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editingId ? {...payload, id: editingId} : payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? t("errors.save"));
      setSuccess(editingId ? t("success.updated") : t("success.created"));
      clearFormState();
      closeFormDrawer();
      await loadData();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("errors.save"));
    } finally {
      setSaving(false);
    }
  }

  async function onChangeStatus(item: ModuleItem, nextStatus: "active" | "inactive") {
    const confirmation = window.confirm(
      nextStatus === "inactive"
        ? t("confirm.deactivate", {name: item.name})
        : t("confirm.reactivate", {name: item.name})
    );
    if (!confirmation) return;
    setSaving(true);
    try {
      const response = await fetch("/api/v1/db/modules", {
        method: nextStatus === "inactive" ? "DELETE" : "PATCH",
        headers,
        body: JSON.stringify(nextStatus === "inactive" ? {id: item.id} : {id: item.id, status: "active"})
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? t("errors.status"));
      setSuccess(nextStatus === "inactive" ? t("success.deactivated") : t("success.reactivated"));
      await loadData();
      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : t("errors.status"));
    } finally {
      setSaving(false);
    }
  }

  function setSort(column: "code" | "name" | "status" | "updated_at") {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  }

  if (loading) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">{t("loadingModules")}</section>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 sm:p-5">
      <article className="space-y-4">
        <header>
          <h2 className="text-2xl font-semibold">{t("title")}</h2>
          <p className="text-sm text-slate-500">{t("description")}</p>
        </header>

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid w-full gap-2 md:grid-cols-[1fr_180px_220px] lg:max-w-[62%]">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("controls.searchPlaceholder")}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "all" | "active" | "inactive");
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
              >
                <option value="all">{t("controls.allStatuses")}</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              <select
                value={scopeFilter}
                onChange={(e) => {
                  setScopeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
              >
                <option value="all">{t("controls.allScopes")}</option>
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>{scope.value ?? scope.name ?? scope.id}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowColumnsMenu((value) => !value);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                >
                  Columnas
                </button>
                {showColumnsMenu ? (
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    {tableColumns.map((column) => (
                      <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                        <input type="checkbox" checked={visibleColumns.has(column.key)} onChange={() => toggleColumn(column.key)} />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <button onClick={openCreateForm} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">{t("controls.addModule")}</button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{t("table.results", {count: visibleModules.length})}</span>
            <label className="flex items-center gap-2">
              Filas por pagina:
              <select
                value={String(rowsPerPage)}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </label>
          </div>

          <div className="overflow-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-500">
                <tr>
                  {headerColumns.map((column) => (
                    <th key={column.key} className="px-4 py-3">
                      {column.key === "code" || column.key === "name" || column.key === "status" || column.key === "updated_at" ? (
                        <button className="font-medium" onClick={() => setSort(column.key as "code" | "name" | "status" | "updated_at")}>{column.label}</button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedModules.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    {headerColumns.map((column) => {
                      if (column.key === "code") return <td key={`${item.id}-code`} className="px-4 py-3 font-medium">{item.code}</td>;
                      if (column.key === "name") return <td key={`${item.id}-name`} className="px-4 py-3">{item.name}</td>;
                      if (column.key === "route") return <td key={`${item.id}-route`} className="px-4 py-3">{item.route ?? "-"}</td>;
                      if (column.key === "status") return <td key={`${item.id}-status`} className="px-4 py-3">{item.status}</td>;
                      if (column.key === "updated_at") return <td key={`${item.id}-updated`} className="px-4 py-3">{item.updated_at ? new Date(item.updated_at).toLocaleString() : "-"}</td>;
                      return (
                        <td key={`${item.id}-actions`} className="relative px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenRowMenu((current) => (current === item.id ? null : item.id));
                            }}
                            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
                          >
                            ⋮
                          </button>
                          {openRowMenu === item.id ? (
                            <div className="absolute right-4 z-10 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                              <button type="button" onClick={() => onEdit(item)} className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50">{t("actions.edit")}</button>
                              {item.status === "active" ? (
                                <button type="button" onClick={() => void onChangeStatus(item, "inactive")} className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50">{t("actions.deactivate")}</button>
                              ) : (
                                <button type="button" onClick={() => void onChangeStatus(item, "active")} className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50">{t("actions.reactivate")}</button>
                              )}
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {pagedModules.length === 0 ? (
                  <tr>
                    <td colSpan={headerColumns.length} className="px-3 py-6 text-center text-slate-500">{t("table.empty")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-col items-start justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center">
            <p>{t("table.pageOf", {page: safePage, total: totalPages})}</p>
            <div className="flex items-center gap-2">
              <button disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-50">{t("pagination.previous")}</button>
              <button disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-50">{t("pagination.next")}</button>
            </div>
          </div>
        </div>
      </article>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50">
          <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${formDrawerVisible ? "opacity-100" : "opacity-0"}`} onClick={closeFormDrawer} />
          <aside className={`absolute right-0 top-0 h-full w-full max-w-[720px] overflow-y-auto bg-white p-5 shadow-2xl transition-transform duration-200 ease-out ${formDrawerVisible ? "translate-x-0" : "translate-x-full"}`}>
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="text-3xl font-semibold">{editingId ? t("form.edit") : t("form.create")}</h3>
                <p className="text-sm text-slate-500">Configura el modulo con la misma experiencia visual del panel lateral.</p>
              </div>
              <button type="button" onClick={closeFormDrawer} className="text-2xl text-slate-400 hover:text-slate-700">×</button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.code")}</label>
                  <input
                    value={form.code}
                    disabled
                    placeholder={editingId ? t("form.immutableCode") : t("form.autoCode")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.name")}</label>
                  <input value={form.name} onChange={(e) => setForm((s) => ({...s, name: e.target.value}))} placeholder={t("form.name")} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
                  {formErrors.name ? <p className="mt-1 text-xs text-rose-600">{formErrors.name}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.route")}</label>
                  <input value={form.route} onChange={(e) => setForm((s) => ({...s, route: e.target.value}))} placeholder={t("form.route")} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.pageContent")}</label>
                  <select
                    value={form.content}
                    onChange={(e) => setForm((s) => ({...s, content: e.target.value}))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                  >
                    {pageContents.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.order")}</label>
                  <input value={form.sort_order} onChange={(e) => setForm((s) => ({...s, sort_order: e.target.value}))} placeholder={t("form.order")} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
                  {formErrors.sort_order ? <p className="mt-1 text-xs text-rose-600">{formErrors.sort_order}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.status")}</label>
                  <select value={form.status} onChange={(e) => setForm((s) => ({...s, status: e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm">
                    {statuses.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                  {formErrors.status ? <p className="mt-1 text-xs text-rose-600">{formErrors.status}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.scope")}</label>
                  <select value={form.scope_id} onChange={(e) => setForm((s) => ({...s, scope_id: e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm">
                    {scopes.map((scope) => (
                      <option key={scope.id} value={scope.id}>{scope.value ?? scope.name ?? scope.id}</option>
                    ))}
                  </select>
                  {formErrors.scope_id ? <p className="mt-1 text-xs text-rose-600">{formErrors.scope_id}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.parent")}</label>
                  <select
                    value={form.parent}
                    onChange={(e) => setForm((s) => ({...s, parent: e.target.value}))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                  >
                    <option value="/">{t("form.root")}</option>
                    {modules
                      .filter((moduleItem) => {
                        if (!moduleItem.route || moduleItem.route.trim().length === 0) return false;
                        if (!editingId) return true;
                        return moduleItem.id !== editingId;
                      })
                      .map((moduleItem) => (
                        <option key={moduleItem.id} value={moduleItem.id}>
                          {moduleItem.route}
                        </option>
                      ))}
                  </select>
                </div>
                {formErrors.parent ? <p className="mt-1 text-xs text-rose-600">{formErrors.parent}</p> : null}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm md:row-span-2">
                  <label className="mb-2 block text-xs text-slate-500">{t("form.icon")}</label>
                  <input type="file" accept="image/*" onChange={(e) => void onIconFile(e.target.files?.[0] ?? null)} className="text-xs" />
                  {iconPreview ? <Image src={iconPreview} alt="Preview" width={40} height={40} className="mt-2 rounded object-cover" unoptimized /> : null}
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">{t("form.descriptionField")}</label>
                  <input value={form.description} onChange={(e) => setForm((s) => ({...s, description: e.target.value}))} placeholder={t("form.descriptionField")} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
                </div>
              </div>
            <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => {
                    clearFormState();
                    closeFormDrawer();
                  }}
                  className="rounded-xl px-4 py-2 text-sm text-rose-600"
                >
                  {t("form.cancel")}
                </button>
                <button disabled={saving} onClick={() => void onSubmit()} className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? t("form.saving") : editingId ? t("form.saveChanges") : t("form.createModule")}</button>
              </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
