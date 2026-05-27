"use client";

import {useCallback, useEffect, useMemo, useState} from "react";

const DEFAULT_COLUMNS = ["id", "name", "value", "type", "actions"];

export function DataManager() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS));
  const [openRowMenu, setOpenRowMenu] = useState<number | null>(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMode, setActionMode] = useState("add");
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [newType, setNewType] = useState({type: "", typeDescription: "", typeUse: ""});
  const [form, setForm] = useState({Initials_PK: "", name: "", value: "", type: "", typeDescription: "", typeUse: "", language: ""});

  const headers = useMemo(
    () => ({
      Authorization: "Bearer local-dev-token",
      "x-oauth-session": "active",
      "x-actor-id": "multidata-ui",
      "x-actor-role": "SU",
      "x-company-id": ""
    }),
    []
  );

  const allColumns = useMemo(
    () => [
      {key: "id", label: "Id"},
      {key: "Initials_PK", label: "Iniciales"},
      {key: "name", label: "Nombre"},
      {key: "value", label: "Valor"},
      {key: "type", label: "Categoria"},
      {key: "typeDescription", label: "Descrip. categoria"},
      {key: "typeUse", label: "Tipo de uso"},
      {key: "actions", label: "Acciones"}
    ],
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/db/st_multidata", {headers});
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "No se pudo cargar multidata");
      const data = Array.isArray(body?.data) ? body.data : [];
      setRows(data);
      const defaultLanguage = data.find((row: any) => String(row?.type || "") === "language")?.value;
      if (defaultLanguage) {
        setLanguage((prev) => (prev === "all" ? String(defaultLanguage) : prev));
        setForm((prev) => ({...prev, language: prev.language || String(defaultLanguage)}));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const closeMenu = () => setOpenRowMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const languageOptions = useMemo(() => {
    return rows.filter((item) => String(item?.type || "") === "language").sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  }, [rows]);

  const typeUseOptions = useMemo(() => {
    const set = new Set(rows.filter((item) => String(item?.type || "") === "typeUse").map((item) => String(item?.value || "")).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((item) => {
      const type = String(item?.type || "").trim();
      if (!type) return;
      if (type === "language" || type === "typeUse") return;
      if (!map.has(type)) {
        map.set(type, {
          type,
          typeDescription: String(item?.typeDescription || ""),
          typeUse: String(item?.typeUse || "")
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.type.localeCompare(b.type));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const rowType = String(row?.type || "");
      const rowLanguage = String(row?.language || "");
      if (typeFilter !== "all" && rowType !== typeFilter) return false;
      if (language !== "all" && rowLanguage && rowLanguage !== language) return false;
      if (!term) return true;
      const text = `${String(row?.id || "")} ${String(row?.Initials_PK || "")} ${String(row?.name || "")} ${String(row?.value || "")} ${rowType}`.toLowerCase();
      return text.includes(term);
    });
  }, [rows, search, typeFilter, language]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, pages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, safePage, rowsPerPage]);

  const headerColumns = useMemo(() => allColumns.filter((column) => visibleColumns.has(column.key)), [allColumns, visibleColumns]);

  const filteredTypeRowsForForm = useMemo(
    () => rows.filter((item) => String(item?.type || "") === String(form.type || "") && (!form.language || String(item?.language || "") === String(form.language || ""))),
    [rows, form.type, form.language]
  );

  const setFormField = (name: string, value: string) => {
    setForm((prev) => ({...prev, [name]: value}));
  };

  const openAddDrawer = () => {
    setActionMode("add");
    setSelectedRow(null);
    setNewType({type: "", typeDescription: "", typeUse: ""});
    setForm({Initials_PK: "", name: "", value: "", type: "", typeDescription: "", typeUse: "", language: language === "all" ? String(languageOptions[0]?.value || "") : language});
    setOpenDrawer(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  };

  const openEditDrawer = (row: any) => {
    setActionMode("edit");
    setSelectedRow(row);
    setNewType({
      type: String(row?.type || ""),
      typeDescription: String(row?.typeDescription || ""),
      typeUse: String(row?.typeUse || "")
    });
    setForm({
      Initials_PK: String(row?.Initials_PK || ""),
      name: String(row?.name || ""),
      value: String(row?.value || ""),
      type: String(row?.type || ""),
      typeDescription: String(row?.typeDescription || ""),
      typeUse: String(row?.typeUse || ""),
      language: String(row?.language || "")
    });
    setOpenDrawer(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    window.setTimeout(() => setOpenDrawer(false), 220);
  };

  const addCategory = () => {
    if (!newType.type.trim() || !newType.typeDescription.trim() || !newType.typeUse.trim()) {
      setError("Completa nombre, descripcion y tipo de uso para agregar categoria.");
      return;
    }
    setError("");
    setForm((prev) => ({
      ...prev,
      type: newType.type.trim(),
      typeDescription: newType.typeDescription.trim(),
      typeUse: newType.typeUse.trim()
    }));
  };

  const saveItem = async () => {
    const required = [form.Initials_PK, form.name, form.value, form.type].every((item) => String(item).trim().length > 0);
    if (!required) {
      setError("Completa Iniciales, Nombre, Valor y Categoria.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (actionMode === "edit" && selectedRow) {
        const response = await fetch("/api/v1/db/st_multidata", {
          method: "PATCH",
          headers: {...headers, "content-type": "application/json"},
          body: JSON.stringify({id: String(selectedRow?.value || ""), ...form})
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || "No se pudo actualizar");
      } else {
        const response = await fetch("/api/v1/db/st_multidata", {
          method: "POST",
          headers: {...headers, "content-type": "application/json"},
          body: JSON.stringify(form)
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || "No se pudo crear");
      }
      closeDrawer();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (valueId: any) => {
    const ok = window.confirm("¿Eliminar este registro?");
    if (!ok) return;
    setError("");
    try {
      const response = await fetch("/api/v1/db/st_multidata", {
        method: "DELETE",
        headers: {...headers, "content-type": "application/json"},
        body: JSON.stringify({id: String(valueId || "")})
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "No se pudo eliminar");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  const toggleColumn = (columnKey: string) => {
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
  };

  return (
    <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="buscar por..."
            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 lg:max-w-[44%]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm">
              <option value="all">Idioma</option>
              {languageOptions.map((item) => (
                <option key={String(item?.value || "")} value={String(item?.value || "")}>{String(item?.name || "")}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm">
              <option value="all">Categoria</option>
              {categoryOptions.map((item) => (
                <option key={item.type} value={item.type}>{item.type}</option>
              ))}
            </select>
            <div className="relative">
              <button type="button" onClick={(event) => {event.stopPropagation(); setShowColumnsMenu((prev) => !prev);}} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm">
                Columnas
              </button>
              {showColumnsMenu ? (
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {allColumns.map((column) => (
                    <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={visibleColumns.has(column.key)} onChange={() => toggleColumn(column.key)} />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={openAddDrawer} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">Agregar</button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>Total {filteredRows.length} registros</p>
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
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-500">Cargando datos...</p> : null}
      {!loading && error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-slate-500">
                <tr>
                  {headerColumns.map((column) => (
                    <th key={column.key} className="px-4 py-3 font-medium">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, index) => (
                  <tr key={`${row?.id || row?.value || "row"}-${index}`} className="border-t border-slate-100">
                    {headerColumns.map((column) => {
                      if (column.key === "id") return <td key={`id-${index}`} className="px-4 py-3">{row?.id ?? (safePage - 1) * rowsPerPage + index + 1}</td>;
                      if (column.key === "actions") {
                        return (
                          <td key={`actions-${index}`} className="relative px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenRowMenu((prev) => (prev === index ? null : index));
                              }}
                              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
                            >
                              ⋮
                            </button>
                            {openRowMenu === index ? (
                              <div className="absolute right-4 z-10 mt-1 w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                <button type="button" onClick={() => openEditDrawer(row)} className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50">Editar</button>
                                <button type="button" onClick={() => deleteItem(row?.value)} className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50">Eliminar</button>
                              </div>
                            ) : null}
                          </td>
                        );
                      }
                      return <td key={`${column.key}-${index}`} className="px-4 py-3">{String(row?.[column.key] || "")}</td>;
                    })}
                  </tr>
                ))}
                {pagedRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={headerColumns.length}>No hay resultados para el filtro actual.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col items-start justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center">
            <p>0 de {filteredRows.length} en seleccion</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage <= 1} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">previo</button>
              <span className="rounded-lg bg-blue-600 px-3 py-1 text-white">{safePage}</span>
              <span>de {pages}</span>
              <button type="button" onClick={() => setPage((prev) => Math.min(pages, prev + 1))} disabled={safePage >= pages} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">siguiente</button>
            </div>
          </div>
        </>
      ) : null}

      {openDrawer ? (
        <div className="fixed inset-0 z-50">
          <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${drawerVisible ? "opacity-100" : "opacity-0"}`} onClick={closeDrawer} />
          <aside className={`absolute right-0 top-0 h-full w-full max-w-[560px] bg-white p-5 shadow-2xl transition-transform duration-200 ease-out ${drawerVisible ? "translate-x-0" : "translate-x-full"}`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-semibold">Agregar Item</h2>
                <p className="mt-1 text-sm text-slate-500">Make changes to the user profile here. Click save when you are done.</p>
              </div>
              <button type="button" onClick={closeDrawer} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-center text-3xl font-medium">Agregar nueva categoria</h3>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5">
                <input
                  value={newType.type}
                  onChange={(event) => setNewType((prev) => ({...prev, type: event.target.value}))}
                  placeholder="Nombre de la categoria"
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm sm:col-span-3"
                />
                <select
                  value={newType.typeUse}
                  onChange={(event) => setNewType((prev) => ({...prev, typeUse: event.target.value}))}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm sm:col-span-2"
                >
                  <option value="">Tipo de uso</option>
                  {typeUseOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
                <input
                  value={newType.typeDescription}
                  onChange={(event) => setNewType((prev) => ({...prev, typeDescription: event.target.value}))}
                  placeholder="Descrip. categoria"
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm sm:col-span-4"
                />
                <button type="button" onClick={addCategory} className="rounded-2xl bg-amber-400 px-4 py-2 text-sm font-medium text-slate-900 sm:col-span-1">Agregar</button>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-center text-3xl font-medium">Agregar nuevo registro</h3>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select value={form.language} onChange={(event) => setFormField("language", event.target.value)} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm">
                  <option value="">Idioma</option>
                  {languageOptions.map((item) => (
                    <option key={String(item?.value || "")} value={String(item?.value || "")}>{String(item?.name || "")}</option>
                  ))}
                </select>
                <select
                  value={form.type}
                  onChange={(event) => {
                    const selected = categoryOptions.find((item) => item.type === event.target.value);
                    setForm((prev) => ({
                      ...prev,
                      type: event.target.value,
                      typeDescription: selected?.typeDescription || "",
                      typeUse: selected?.typeUse || ""
                    }));
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                >
                  <option value="">Categoria</option>
                  {categoryOptions.map((item) => (
                    <option key={item.type} value={item.type}>{item.type}</option>
                  ))}
                </select>
                <input value={form.typeUse} readOnly placeholder="Tipo de uso" className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <input
                    list="initials-options"
                    value={form.Initials_PK}
                    onChange={(event) => setFormField("Initials_PK", event.target.value)}
                    placeholder="Iniciales"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                  />
                  <datalist id="initials-options">
                    {filteredTypeRowsForForm.map((item) => (
                      <option key={`i-${String(item?.value || "")}-${String(item?.Initials_PK || "")}`} value={String(item?.Initials_PK || "")} />
                    ))}
                  </datalist>
                </div>
                <input value={form.typeDescription} readOnly placeholder="Descrip. categoria" className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <input
                    list="name-options"
                    value={form.name}
                    onChange={(event) => setFormField("name", event.target.value)}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                  />
                  <datalist id="name-options">
                    {filteredTypeRowsForForm.map((item) => (
                      <option key={`n-${String(item?.value || "")}-${String(item?.name || "")}`} value={String(item?.name || "")} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <input
                    list="value-options"
                    value={form.value}
                    onChange={(event) => setFormField("value", event.target.value)}
                    placeholder="Valor"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                  />
                  <datalist id="value-options">
                    {filteredTypeRowsForForm.map((item) => (
                      <option key={`v-${String(item?.value || "")}-${String(item?.name || "")}`} value={String(item?.value || "")} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeDrawer} className="rounded-xl px-4 py-2 text-sm text-rose-600">Cancelar</button>
              <button type="button" disabled={saving} onClick={saveItem} className="rounded-2xl bg-blue-600 px-6 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Guardando..." : actionMode === "edit" ? "Guardar" : "Crear"}</button>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

export default DataManager;
