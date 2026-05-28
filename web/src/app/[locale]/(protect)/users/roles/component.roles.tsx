"use client";

import {Fragment, useCallback, useEffect, useMemo, useState} from "react";

// Claves de caché de cliente estandarizadas
const MODULES_CACHE_KEY = "roles_modules_cache";
const ROLES_CACHE_KEY = "roles_list_cache";

type Permission = {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  microroles?: Record<string, boolean>;
};

type RoleRecord = {
  id: string;
  key_id: string;
  name: string;
  description: string;
  scope: string;
  company_id: string | null;
  status: string;
  permissions?: Record<string, Permission>;
};

// Solo se cargan los módulos existentes en la base de datos
const DEFAULT_FALLBACK_ROLES: RoleRecord[] = [
  {
    id: "r-superadmin",
    key_id: "SU",
    name: "Super Admin",
    description: "Acceso total del sistema",
    scope: "SU",
    company_id: "900000000",
    status: "active",
    permissions: {}
  },
  {
    id: "r-admin",
    key_id: "ADM",
    name: "Administrador",
    description: "Acceso administrativo",
    scope: "admin",
    company_id: "900000000",
    status: "active",
    permissions: {}
  },
  {
    id: "r-vendedor",
    key_id: "VEN",
    name: "Vendedor",
    description: "Acceso para personal de ventas",
    scope: "user",
    company_id: "900000000",
    status: "active",
    permissions: {}
  }
];

function getModuleIcon(route: string, dbIcon?: string | null) {
  if (dbIcon && dbIcon.trim()) return dbIcon;
  const r = route.toLowerCase();
  if (r.includes("post")) return "📦";
  if (r.includes("bounch")) return "💐";
  if (r.includes("store")) return "❄️";
  if (r.includes("registry")) return "🩺";
  if (r === "/" || r === "/home") return "🏠";
  if (r.includes("dashboard")) return "👤";
  if (r.includes("farm") || r.includes("cultivo")) return "🏡";
  if (r.includes("human-talent") || r.includes("talent")) return "👥";
  if (r.includes("admin")) return "⚙️";
  if (r.includes("settings") || r.includes("config")) return "⚙️";
  return "🔗";
}

function isImageIcon(value: string | null) {
  if (!value) return false;
  const icon = value.trim().toLowerCase();
  return icon.startsWith("data:image/") || icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/");
}

function renderModuleIcon(icon?: string | null) {
  if (!icon) return null;
  if (isImageIcon(icon)) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-400 p-1 shadow-sm shrink-0">
        <img 
          src={icon} 
          alt="icon" 
          className="h-4 w-4 object-contain" 
          style={{ filter: "drop-shadow(0px 0.5px 1px rgba(0,0,0,0.5))" }}
        />
      </div>
    );
  }
  return <span className="text-base">{icon}</span>;
}

export function DynamicComponent() {
  const [dbModules, setDbModules] = useState<any[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Metadatos del Rol Seleccionado
  const [roleForm, setRoleForm] = useState({
    key_id: "",
    name: "",
    description: "",
    scope: "user",
    company_id: "900000000"
  });

  // Estado de permisos: { [moduleId]: { read, create, update, delete, microroles } }
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});

  // Microroles / Acciones específicas por módulo
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [newMicroNames, setNewMicroNames] = useState<Record<string, string>>({});
  const [customMicroRoles, setCustomMicroRoles] = useState<Record<string, Array<{ key: string; label: string }>>>({
    "m-postcosecha": [
      { key: "scan_post", label: "Escanear Postcosecha" },
      { key: "approve_lot", label: "Aprobar Lote" }
    ],
    "m-boncheo": [
      { key: "scan_bounch", label: "Escanear Boncheo" }
    ],
    "m-registrar-enf": [
      { key: "diagnose_plant", label: "Diagnosticar Planta" }
    ],
    "m-cultivo-asignaciones": [
      { key: "assign_task", label: "Asignar Tareas" }
    ],
    "m-admin-user": [
      { key: "approve_user", label: "Aprobar Usuario" },
      { key: "reject_user", label: "Rechazar Usuario" }
    ],
    "m-admin-roles": [
      { key: "clone_role", label: "Clonar Rol" }
    ]
  });

  // Estado para el modal personalizado
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"create" | "edit">("create");
  const [modalModuleId, setModalModuleId] = useState("");
  const [modalMicroKey, setModalMicroKey] = useState("");
  const [modalInputValue, setModalInputValue] = useState("");
  const [modalModuleName, setModalModuleName] = useState("");

  const openCreateModal = (moduleId: string, moduleName: string) => {
    setModalType("create");
    setModalModuleId(moduleId);
    setModalModuleName(moduleName);
    setModalMicroKey("");
    setModalInputValue("");
    setModalOpen(true);
  };

  const openEditModal = (moduleId: string, microKey: string, currentLabel: string) => {
    setModalType("edit");
    setModalModuleId(moduleId);
    setModalMicroKey(microKey);
    setModalInputValue(currentLabel);
    setModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = modalInputValue.trim();
    if (!value) return;

    if (modalType === "create") {
      const key = value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      setCustomMicroRoles((prev) => {
        const list = prev[modalModuleId] || [];
        if (list.some((it) => it.key === key)) return prev;
        return {
          ...prev,
          [modalModuleId]: [...list, { key, label: value }]
        };
      });
    } else {
      setCustomMicroRoles((prev) => {
        const list = prev[modalModuleId] || [];
        return {
          ...prev,
          [modalModuleId]: list.map((it) => it.key === modalMicroKey ? { ...it, label: value } : it)
        };
      });
    }
    setModalOpen(false);
  };

  const setFormField = (fieldName: string, value: string) => {
    setRoleForm((prev) => ({...prev, [fieldName]: value}));
  };

  const headers = useMemo(
    () => ({
      Authorization: "Bearer local-dev-token",
      "x-oauth-session": "active",
      "x-actor-id": "roles-ui",
      "x-actor-role": "SU",
      "x-company-id": ""
    }),
    []
  );

  // 1. Cargar Módulos y Roles con Stale-While-Revalidate (LOCAL_DB_CACHE_MANUAL)
  useEffect(() => {
    let hasLoadedModulesCache = false;
    let hasLoadedRolesCache = false;

    // A. Cargar desde LocalStorage inmediatamente
    if (typeof window !== "undefined") {
      const cachedModules = localStorage.getItem(MODULES_CACHE_KEY);
      if (cachedModules) {
        try {
          const data = JSON.parse(cachedModules);
          if (Array.isArray(data)) {
            setDbModules(data);
            hasLoadedModulesCache = true;
          }
        } catch {
          // Ignorar y continuar
        }
      }

      const cachedRoles = localStorage.getItem(ROLES_CACHE_KEY);
      if (cachedRoles) {
        try {
          const data = JSON.parse(cachedRoles);
          if (Array.isArray(data)) {
            const list = data.length > 0 ? data : DEFAULT_FALLBACK_ROLES;
            setRoles(list);
            hasLoadedRolesCache = true;
            if (list.length > 0) {
              setSelectedRoleId(list[0].id);
            }
          }
        } catch {
          // Ignorar
        }
      } else {
        setRoles(DEFAULT_FALLBACK_ROLES);
        setSelectedRoleId(DEFAULT_FALLBACK_ROLES[0].id);
      }
    }

    if (!hasLoadedModulesCache || !hasLoadedRolesCache) {
      setLoading(true);
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        // Fetch Módulos
        const modRes = await fetch("/api/v1/db/modules", {headers});
        const modBody = await modRes.json();
        const fetchedModules = Array.isArray(modBody?.data) ? modBody.data : [];

        // Fetch Roles
        const roleRes = await fetch("/api/v1/db/roles", {headers});
        const roleBody = await roleRes.json();
        const fetchedRoles = Array.isArray(roleBody?.data) ? roleBody.data : [];

        if (cancelled) return;

        // Actualizar estados si difieren
        setDbModules((prev) => {
          const isSame = JSON.stringify(prev) === JSON.stringify(fetchedModules);
          return isSame ? prev : fetchedModules;
        });

        const rolesList = fetchedRoles.length > 0 ? fetchedRoles : DEFAULT_FALLBACK_ROLES;
        setRoles((prev) => {
          const isSame = JSON.stringify(prev) === JSON.stringify(rolesList);
          if (isSame) return prev;
          if (rolesList.length > 0 && !selectedRoleId) {
            setSelectedRoleId(rolesList[0].id);
          }
          return rolesList;
        });

        // Guardar en caché local
        if (typeof window !== "undefined") {
          localStorage.setItem(MODULES_CACHE_KEY, JSON.stringify(fetchedModules));
          localStorage.setItem(ROLES_CACHE_KEY, JSON.stringify(fetchedRoles));
        }

      } catch (err) {
        if (!hasLoadedRolesCache) {
          setError("Error al comunicar con la base de datos.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => { cancelled = true; };
  }, [headers, selectedRoleId]);

  // Se listan exclusivamente los módulos existentes persistidos en la base de datos
  const activeModules = useMemo(() => {
    return dbModules
      .filter((dbMod) => dbMod.status === "active")
      .map((dbMod) => {
        let category = "Menu Principal";
        if (dbMod.parent === "mobile-root") {
          category = "Aplicación Móvil";
        } else if (dbMod.route.startsWith("/admin") || dbMod.route.startsWith("/settings")) {
          category = "General";
        }

        return {
          id: dbMod.id,
          name: dbMod.name,
          route: dbMod.route,
          parent: dbMod.parent || "/",
          category: category,
          icon: getModuleIcon(dbMod.route, dbMod.icon)
        };
      });
  }, [dbModules]);

  // Módulos clasificados por secciones
  const sections = useMemo(() => {
    const categories = ["Aplicación Móvil", "Menu Principal", "General"];
    return categories.map((cat) => {
      const items = activeModules.filter((m) => m.category === cat);
      
      // Ordenar jerárquicamente: padres primero, hijos inmediatamente debajo
      const ordered: any[] = [];
      const parents = items.filter((m) => m.parent === "/" || m.parent === "mobile-root");
      
      parents.forEach((parent) => {
        ordered.push(parent);
        const children = items.filter((m) => m.parent === parent.id);
        ordered.push(...children);
      });

      return { category: cat, items: ordered };
    });
  }, [activeModules]);

  // Cargar metadatos y permisos del Rol seleccionado
  const selectedRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (selectedRole) {
      setRoleForm({
        key_id: selectedRole.key_id || "",
        name: selectedRole.name || "",
        description: selectedRole.description || "",
        scope: selectedRole.scope || "user",
        company_id: selectedRole.company_id || "900000000"
      });

      // Inicializar matriz de permisos desde JSON o por defecto activos
      const savedPerms = selectedRole.permissions || {};
      const newPerms: Record<string, Permission> = {};
      activeModules.forEach((m) => {
        newPerms[m.id] = savedPerms[m.id] || { read: true, create: true, update: true, delete: true, microroles: {} };
      });
      setPermissions(newPerms);
    }
  }, [selectedRole, activeModules]);

  const handleCheckboxChange = (moduleId: string, type: keyof Permission) => {
    if (!isEditing) return;
    setPermissions((prev) => {
      const current = prev[moduleId] || { read: false, create: false, update: false, delete: false, microroles: {} };
      return {
        ...prev,
        [moduleId]: {
          ...current,
          [type]: !current[type as keyof Permission]
        } as any
      };
    });
  };

  const handleMicroRoleToggle = (moduleId: string, microKey: string) => {
    if (!isEditing) return;
    setPermissions((prev) => {
      const modulePerm = prev[moduleId] || { read: false, create: false, update: false, delete: false, microroles: {} };
      const currentMicros = modulePerm.microroles || {};
      return {
        ...prev,
        [moduleId]: {
          ...modulePerm,
          microroles: {
            ...currentMicros,
            [microKey]: !currentMicros[microKey]
          }
        }
      };
    });
  };

  const toggleExpand = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const addCustomMicroRole = (moduleId: string) => {
    const name = (newMicroNames[moduleId] || "").trim();
    if (!name) return;
    
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    setCustomMicroRoles((prev) => {
      const list = prev[moduleId] || [];
      if (list.some((item) => item.key === key)) return prev;
      return {
        ...prev,
        [moduleId]: [...list, { key, label: name }]
      };
    });
    setNewMicroNames((prev) => ({ ...prev, [moduleId]: "" }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...roleForm,
        permissions
      };
      
      const response = await fetch("/api/v1/db/roles", {
        method: "PATCH",
        headers: {...headers, "content-type": "application/json"},
        body: JSON.stringify({ id: selectedRoleId, ...payload })
      });
      
      if (!response.ok) throw new Error("No se pudo guardar la configuración de permisos");
      
      // Limpiar caché local e invalidar
      if (typeof window !== "undefined") {
        localStorage.removeItem(ROLES_CACHE_KEY);
      }
      setIsEditing(false);
      
      // Recargar roles
      const roleRes = await fetch("/api/v1/db/roles", {headers});
      const roleBody = await roleRes.json();
      const fetchedRoles = Array.isArray(roleBody?.data) ? roleBody.data : [];
      setRoles(fetchedRoles);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRole = async () => {
    const name = window.prompt("Nombre del nuevo Cargo:");
    if (!name) return;
    const key = window.prompt("ID Clave del Cargo (máx 5 letras, ej: VEN):");
    if (!key) return;
    
    setSaving(true);
    try {
      const newRole = {
        name,
        key_id: key.toUpperCase().slice(0, 5),
        description: `Cargo ${name} de la plataforma`,
        scope: "user",
        company_id: "900000000",
        status: "active"
      };

      const response = await fetch("/api/v1/db/roles", {
        method: "POST",
        headers: {...headers, "content-type": "application/json"},
        body: JSON.stringify(newRole)
      });
      
      if (!response.ok) throw new Error("No se pudo crear el rol");
      const body = await response.json();
      
      // Actualizar listado
      if (typeof window !== "undefined") {
        localStorage.removeItem(ROLES_CACHE_KEY);
      }
      
      const roleRes = await fetch("/api/v1/db/roles", {headers});
      const roleBody = await roleRes.json();
      const fetchedRoles = Array.isArray(roleBody?.data) ? roleBody.data : [];
      setRoles(fetchedRoles);
      if (body?.data?.id) {
        setSelectedRoleId(body.data.id);
      }
      setIsEditing(true);
    } catch (err) {
      setError("No fue posible crear el rol en la base de datos.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    const ok = window.confirm("¿Seguro que deseas eliminar este rol?");
    if (!ok) return;
    setSaving(true);
    try {
      const response = await fetch("/api/v1/db/roles", {
        method: "DELETE",
        headers: {...headers, "content-type": "application/json"},
        body: JSON.stringify({ id: selectedRoleId })
      });
      if (!response.ok) throw new Error("No se pudo eliminar el rol");
      
      if (typeof window !== "undefined") {
        localStorage.removeItem(ROLES_CACHE_KEY);
      }
      
      const roleRes = await fetch("/api/v1/db/roles", {headers});
      const roleBody = await roleRes.json();
      const fetchedRoles = Array.isArray(roleBody?.data) ? roleBody.data : [];
      setRoles(fetchedRoles);
      if (fetchedRoles.length > 0) {
        setSelectedRoleId(fetchedRoles[0].id);
      }
      setIsEditing(false);
    } catch {
      setError("No fue posible eliminar el rol.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 overflow-hidden text-slate-800">
      <div className="flex flex-col gap-6 flex-shrink-0">
        
        {/* PANEL SUPERIOR DE ACCIONES */}
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <label className="block w-full lg:max-w-[280px]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cargo</span>
            <select
              value={selectedRoleId}
              disabled={isEditing}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 disabled:opacity-60"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          
          <div className="flex flex-wrap items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                >
                  Editar Rol
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRole}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition shadow-sm"
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={handleAddRole}
                  className="rounded-xl bg-[#2ad072] px-6 py-2 text-sm font-bold text-white hover:bg-emerald-600 transition shadow-sm"
                >
                  Agregar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-md"
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* DETALLES Y METADATOS DEL ROL */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Id clave</span>
            <input
              value={roleForm.key_id}
              disabled
              placeholder="Ej: SU"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono text-slate-500 outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Descripción</span>
            <input
              value={roleForm.description}
              disabled={!isEditing}
              onChange={(e) => setFormField("description", e.target.value)}
              placeholder="Descripción del rol o cargo"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white disabled:opacity-60 transition"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Alcance</span>
            <select
              value={roleForm.scope}
              disabled={!isEditing}
              onChange={(e) => setFormField("scope", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white disabled:opacity-60 transition"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="SU">Super Admin</option>
            </select>
          </label>
        </div>

        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      </div>

      {/* CONTENEDOR CON SCROLL PARA LA GRILLA DE PERMISOS */}
      <div className="mt-6 flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
        {sections.map((sect) => (
          <div key={sect.category} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            
            {/* HEADER DE LA CATEGORÍA */}
            <div className="bg-slate-100 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              {sect.category}
            </div>

            {/* TABLA DE DETALLES */}
            <table className="min-w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="w-[45%] px-4 py-2 text-left font-semibold">MÓDULO / RUTA</th>
                  <th className="w-[11%] py-2 font-semibold">LEER</th>
                  <th className="w-[11%] py-2 font-semibold">CREAR</th>
                  <th className="w-[11%] py-2 font-semibold">ACTUALIZAR</th>
                  <th className="w-[11%] py-2 font-semibold">BORRAR</th>
                  <th className="w-[11%] py-2 font-semibold">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sect.items.map((item) => {
                  const isChild = item.parent !== "/" && item.parent !== "mobile-root";
                  const perm = permissions[item.id] || { read: false, create: false, update: false, delete: false, microroles: {} };
                  const isExpanded = !!expandedModules[item.id];
                  const moduleMicros = customMicroRoles[item.id] || [];
                  const hasChildren = activeModules.some((m) => m.parent === item.id);

                  return (
                    <Fragment key={item.id}>
                      <tr className="hover:bg-slate-50/50 transition duration-150">
                        <td className={`px-4 py-3 text-slate-700 flex items-center gap-2 ${isChild ? "pl-8 text-xs text-slate-500" : "font-semibold"}`}>
                          {!isChild && renderModuleIcon(item.icon)}
                          <span>{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({item.route})</span>
                        </td>
                        
                        {/* CHECKBOXES DE PERMISOS */}
                        {(["read", "create", "update", "delete"] as Array<"read" | "create" | "update" | "delete">).map((type) => (
                          <td key={type} className="py-3 text-center">
                            <button
                              type="button"
                              disabled={!isEditing}
                              onClick={() => handleCheckboxChange(item.id, type)}
                              className={`inline-flex h-5 w-5 items-center justify-center rounded-md border text-white transition focus:outline-none ${
                                perm[type]
                                  ? "bg-[#9b5de5] border-[#9b5de5] shadow-sm shadow-purple-200"
                                  : "border-slate-200 hover:border-slate-300 bg-white"
                              } ${!isEditing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              {perm[type] && (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="h-3 w-3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </button>
                          </td>
                        ))}

                        {/* BOTÓN PARA DESPLEGAR MICROROLES */}
                        <td className="py-3 text-center">
                          {!hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(item.id)}
                              className={`rounded-xl px-3 py-1 text-xs font-semibold border transition duration-150 ${
                                isExpanded 
                                  ? "bg-white text-purple-600 border-purple-600 font-bold shadow-sm shadow-purple-50" 
                                  : "bg-white hover:bg-slate-50 text-slate-500 border-slate-200"
                              }`}
                            >
                              {isExpanded ? "Ocultar" : "Microroles"}
                            </button>
                          ) : (
                            <span className="text-slate-300 font-medium" title="Módulo contenedor (embebido)">—</span>
                          )}
                        </td>
                      </tr>

                      {/* LISTADO DE MICROROLES DESPLEGABLE */}
                      {isExpanded && !hasChildren && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={6} className="px-6 py-4 border-t border-slate-100/60">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                  <span>Microroles / Acciones de {item.name.toUpperCase()}</span>
                                  {isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => openCreateModal(item.id, item.name)}
                                      className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e293b] hover:bg-[#334155] text-white transition duration-150 shadow-sm border border-slate-700"
                                      title="Agregar nuevo microrol"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                                      </svg>
                                    </button>
                                  )}
                                </h4>
                              </div>

                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                                {moduleMicros.map((micro) => {
                                  const isGranted = !!(perm.microroles?.[micro.key]);
                                  return (
                                    <div 
                                      key={micro.key} 
                                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium shadow-sm hover:bg-slate-50 transition gap-2 group"
                                    >
                                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                        <input
                                          type="checkbox"
                                          disabled={!isEditing}
                                          checked={isGranted}
                                          onChange={() => handleMicroRoleToggle(item.id, micro.key)}
                                          className="h-4 w-4 rounded border-slate-300 text-[#9b5de5] focus:ring-[#9b5de5] cursor-pointer"
                                        />
                                        <span className="text-slate-700 truncate">{micro.label}</span>
                                      </label>
                                      
                                      {isEditing && (
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          {/* EDIT BUTTON */}
                                          <button
                                            type="button"
                                            onClick={() => openEditModal(item.id, micro.key, micro.label)}
                                            className="border border-slate-200 bg-white hover:bg-slate-50 p-1 rounded-md text-slate-600 transition shadow-sm"
                                            title="Editar"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                                            </svg>
                                          </button>

                                          {/* DELETE BUTTON */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const ok = window.confirm(`¿Seguro que deseas eliminar el microrol "${micro.label}"?`);
                                              if (ok) {
                                                setCustomMicroRoles((prev) => {
                                                  const list = prev[item.id] || [];
                                                  return {
                                                    ...prev,
                                                    [item.id]: list.filter((it) => it.key !== micro.key)
                                                  };
                                                });
                                              }
                                            }}
                                            className="border border-slate-200 bg-white hover:bg-slate-50 p-1 rounded-md text-slate-600 transition shadow-sm hover:text-red-500"
                                            title="Eliminar"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 6m-4.78 0L9 9m12 6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6h16v9Z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6M10 2h4" />
                                            </svg>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {moduleMicros.length === 0 && (
                                  <p className="text-xs text-slate-400 italic">No hay microroles de negocio definidos. Agrega uno nuevo en modo edición.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* MODAL PERSONALIZADO Y ESTILIZADO */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* BACKDROP BLUR (GLASSMORPHISM) */}
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setModalOpen(false)}
          />
          
          {/* CONTENEDOR DEL MODAL PREMIUM */}
          <form 
            onSubmit={handleModalSubmit}
            className="relative bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 w-full max-w-[400px] flex flex-col gap-5 transform transition-all animate-in fade-in zoom-in-95 duration-200"
          >
            {/* ENCABEZADO CON ICONO Y BOTÓN CERRAR */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#9b5de5] to-[#743eb3] text-white shadow-md shadow-purple-200">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.99l1.005.831a1.125 1.125 0 0 1 .26 1.43l-1.297 2.247a1.125 1.125 0 0 1-1.37.491l-1.216-.456c-.356-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.83c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-base font-bold text-slate-800 leading-tight">
                  {modalType === "create" ? "Nuevo Microrol" : "Editar Microrol"}
                </h3>
                <span className="text-xs text-slate-400 font-medium truncate">
                  {modalType === "create" ? `Módulo: ${modalModuleName}` : "Actualizar acción"}
                </span>
              </div>
              
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition duration-150"
                title="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* CUERPO DEL FORMULARIO */}
            <div className="flex flex-col gap-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                {modalType === "create" 
                  ? "Las acciones o microroles te permiten definir permisos ultra-específicos de negocio para este módulo de manera dinámica."
                  : "Modifica el nombre de la acción seleccionada. Los cambios se aplicarán de inmediato en la grilla de control."}
              </p>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Nombre descriptivo
                </span>
                <input
                  type="text"
                  required
                  value={modalInputValue}
                  onChange={(e) => setModalInputValue(e.target.value)}
                  placeholder="Ej: Aprobar Lote de Flores"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:bg-white transition duration-200"
                  autoFocus
                />
              </label>
            </div>

            {/* ACCIONES DEL PIE */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-600 transition duration-150 hover:border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-[#9b5de5] to-[#743eb3] hover:from-[#864cc7] hover:to-[#632f9e] px-6 py-2.5 text-sm font-bold text-white transition duration-200 shadow-md shadow-purple-100 hover:shadow-purple-200 active:scale-[0.98] transform"
              >
                {modalType === "create" ? "Crear Acción" : "Guardar Cambios"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export default DynamicComponent;