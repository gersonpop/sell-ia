"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { selectSidebarModulesFromDbRows, type DynamicModuleNav } from "@/lib/sidebar-access";

type SidebarMode = "compact" | "auto" | "fixed";

function isImageIcon(value: string) {
  const icon = value.trim().toLowerCase();
  return icon.startsWith("data:image/") || icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/");
}

function normalizeTextIcon(value: string) {
  const icon = value.trim();
  if (icon.length === 1 || icon.length === 2) return icon;
  return "◦";
}

type ProtectedSidebarLayoutProps = {
  locale: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  actorId: string;
  actorRole: "SU" | "cliente" | string;
  companyId?: string | null;
  initialModules?: DynamicModuleNav[];
  title?: string;
  description?: string;
  children?: React.ReactNode;
};

export function ProtectedSidebarLayout({
  locale,
  userName,
  userEmail,
  userImage,
  actorId,
  actorRole,
  companyId = null,
  initialModules,
  children
}: ProtectedSidebarLayoutProps) {
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>("fixed");
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [darkPanel, setDarkPanel] = useState(true);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const navScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [dynamicModules, setDynamicModules] = useState<DynamicModuleNav[]>(initialModules ?? []);
  const [modulesLoading, setModulesLoading] = useState(initialModules === undefined);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const normalizedActorRole: "SU" | "cliente" = String(actorRole).trim().toLowerCase() === "su" ? "SU" : "cliente";

  const expanded = mode === "fixed" || (mode === "auto" && hoverExpanded);
  const compact = mode === "compact" || (mode === "auto" && !hoverExpanded);
  const hidden = false;

  const sidebarWidthClass = useMemo(() => {
    if (expanded) return "w-[256px]";
    return "w-[72px]";
  }, [expanded]);

  const navItems = useMemo(
    () =>
      dynamicModules.map((item) => ({
        id: item.id,
        label: item.name,
        icon: item.icon ?? "◦",
        path: item.route ?? "",
        badge: (item as any).badge ?? undefined
      })),
    [dynamicModules]
  );

  useEffect(() => {
    if (initialModules !== undefined) {
      setDynamicModules(initialModules);
      setModulesLoading(false);
      return;
    }

    const cacheKey = `sidebar_modules_${actorId}_${companyId ?? ""}`;
    let hasLoadedFromCache = false;

    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const rows = JSON.parse(cached);
          if (Array.isArray(rows)) {
            setDynamicModules(selectSidebarModulesFromDbRows(rows));
            setModulesLoading(false);
            hasLoadedFromCache = true;
          }
        } catch {
          // Ignore error and continue to fetch
        }
      }
    }

    let cancelled = false;
    const loadModules = async () => {
      if (!hasLoadedFromCache) {
        setModulesLoading(true);
      }
      setModulesError(null);
      try {
        const params = new URLSearchParams();
        params.append("table", "modules");
        const response = await fetch(`/api/v1/db/multi?${params.toString()}`, {
          headers: {
            Authorization: "Bearer local-dev-token",
            "x-oauth-session": "active",
            "x-actor-id": actorId,
            "x-actor-role": normalizedActorRole,
            "x-company-id": companyId ?? ""
          }
        });
        const body = (await response.json()) as { modules?: Array<Record<string, unknown>>; message?: string };
        if (!response.ok) {
          throw new Error(body.message ?? "No se pudo cargar el menu");
        }
        if (cancelled) return;
        const rows = Array.isArray(body.modules) ? body.modules : [];
        const normalizedFetched = selectSidebarModulesFromDbRows(rows);

        setDynamicModules((prev) => {
          const isSame = JSON.stringify(prev) === JSON.stringify(normalizedFetched);
          return isSame ? prev : normalizedFetched;
        });

        if (typeof window !== "undefined") {
          localStorage.setItem(cacheKey, JSON.stringify(rows));
        }
      } catch (error) {
        if (!cancelled && !hasLoadedFromCache) {
          setDynamicModules([]);
          setModulesError(error instanceof Error ? error.message : "No se pudo cargar el menu");
        }
      } finally {
        if (!cancelled) {
          setModulesLoading(false);
        }
      }
    };
    void loadModules();
    return () => {
      cancelled = true;
    };
  }, [actorId, normalizedActorRole, companyId, initialModules]);

  const updateScrollHints = () => {
    const element = navScrollRef.current;
    if (!element) return;
    const { scrollTop, scrollHeight, clientHeight } = element;
    setCanScrollUp(scrollTop > 6);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 6);
  };

  useEffect(() => {
    updateScrollHints();
  }, [expanded, compact, mode]);

  const scrollModules = (direction: "up" | "down") => {
    const element = navScrollRef.current;
    if (!element) return;
    const amount = Math.max(120, Math.round(element.clientHeight * 0.45));
    element.scrollBy({ top: direction === "up" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <main
      className="relative flex h-dvh overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/home-brackgorund.png')" }}
    >
      <div className="absolute inset-0 bg-white/5" />

      <aside
        onMouseEnter={() => mode === "auto" && setHoverExpanded(true)}
        onMouseLeave={() => mode === "auto" && setHoverExpanded(false)}
        className={`relative z-20 h-full shrink-0 overflow-hidden border-r border-white/20 transition-[width,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarWidthClass} ${hidden ? "-translate-x-full" : "translate-x-0"
          }`}
      >
        <div
          className={`h-full ${compact ? "p-2" : "p-2"} ${darkPanel
            ? "bg-gradient-to-b from-slate-900/78 via-indigo-900/52 to-slate-950/86"
            : "bg-gradient-to-b from-sky-700/45 via-indigo-700/30 to-slate-900/56"
            } backdrop-blur-xl`}
        >
          <div
            className={`relative flex h-full flex-col overflow-hidden ${compact
              ? "rounded-none border-0 bg-transparent backdrop-blur-none"
              : "glass-shell rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl"
              }`}
          >
            {compact ? null : (
              <>
                <span className="glass-sheen pointer-events-none absolute -left-14 top-[-24%] h-[52%] w-[145%] rotate-[14deg] bg-gradient-to-r from-transparent via-white/18 to-transparent" />
                <span className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/20 via-white/7 to-transparent" />
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/55" />
                <span className="pointer-events-none absolute inset-[2px] rounded-[14px] border border-white/12" />
              </>
            )}
            <div className={`shrink-0 ${compact ? "p-2 px-1" : "border-b border-white/18 p-4"}`}>
              <div className={`flex items-center ${expanded ? "gap-3" : "justify-center"}`}>
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/30 bg-white/10">
                  {userImage && !avatarError ? (
                    <img
                      src={userImage}
                      alt={userName}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm font-semibold text-white">
                      {userName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                {expanded ? (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-[0.01em] text-white">{userName}</p>
                    <p className="truncate text-[11px] text-white/70">{userEmail}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={`relative min-h-0 flex-1 ${compact ? "px-0 py-4" : "px-2 py-3"}`}>
              <button
                type="button"
                aria-label="Subir modulos"
                onClick={() => scrollModules("up")}
                className={`absolute left-1/2 top-1 z-10 -translate-x-1/2 rounded-full border border-white/30 bg-slate-900/35 px-3 py-0.5 text-xs text-white backdrop-blur-md transition ${canScrollUp ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Bajar modulos"
                onClick={() => scrollModules("down")}
                className={`absolute bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/30 bg-slate-900/35 px-3 py-0.5 text-xs text-white backdrop-blur-md transition ${canScrollDown ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
              >
                ↓
              </button>
              <span
                className={`pointer-events-none absolute inset-x-1 top-0 z-[5] h-14 rounded-t-xl bg-gradient-to-b from-slate-950/42 to-transparent transition ${canScrollUp ? "opacity-100" : "opacity-0"
                  }`}
              />
              <span
                className={`pointer-events-none absolute inset-x-1 bottom-0 z-[5] h-14 rounded-b-xl bg-gradient-to-t from-slate-950/42 to-transparent transition ${canScrollDown ? "opacity-100" : "opacity-0"
                  }`}
              />
              <div
                ref={navScrollRef}
                onScroll={updateScrollHints}
                className="hide-scrollbar relative h-full overflow-y-auto"
              >
                {compact ? <div className="mx-auto mb-3 h-px w-12 bg-white/20" /> : null}
                <p className={`px-2 pb-2 text-[10px] uppercase tracking-[0.18em] text-white/55 ${compact ? "text-center" : ""}`}>
                  {compact ? "Menu" : "Modulos"}
                </p>
                {modulesError ? (
                  <div className="rounded-xl border border-rose-300/35 bg-rose-950/35 px-3 py-2 text-xs text-rose-100">
                    No se pudo cargar el menu. Intenta de nuevo.
                  </div>
                ) : null}
                {modulesLoading ? (
                  <div className="space-y-2 px-2 py-1">
                    <div className="h-8 animate-pulse rounded-lg bg-white/12" />
                    <div className="h-8 animate-pulse rounded-lg bg-white/12" />
                    <div className="h-8 animate-pulse rounded-lg bg-white/12" />
                  </div>
                ) : null}
                {!modulesLoading && !modulesError && navItems.length === 0 ? (
                  <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/85">Sin modulos disponibles</div>
                ) : null}
                {!modulesLoading && !modulesError ? (
                  <nav className={compact ? "space-y-" : "space-y-1"}>
                    {navItems.map((item) => {
                      const href = `/${locale}${item.path}`;
                      const isActive = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={`group flex w-full items-center text-left text-white/90 transition duration-300 ${isActive
                            ? expanded
                              ? "gap-3 rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-2 py-2"
                              : "justify-center rounded-lg bg-cyan-300/20 px-0 py-2.5 text-cyan-100"
                            : expanded
                              ? "gap-3 rounded-xl border border-transparent px-2 py-2 hover:border-white/20 hover:bg-white/12"
                              : "justify-center rounded-lg px-0 py-2.5 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                          <span className={`grid place-items-center text-[22px] leading-none text-white/95 ${expanded ? "h-9 w-9" : "h-7 w-7"}`}>
                            {isImageIcon(item.icon) ? (
                              <img src={item.icon} alt="icon" className="h-5 w-5 object-contain" />
                            ) : (
                              normalizeTextIcon(item.icon)
                            )}
                          </span>
                          {expanded ? (
                            <>
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.label}</span>
                              {item.badge ? (
                                <span className="rounded-full bg-cyan-300/25 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                                  {item.badge}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </Link>
                      );
                    })}
                  </nav>
                ) : null}
              </div>
            </div>

            <div className={`shrink-0 ${compact ? "border-t border-white/12 py-1 px-2" : "border-t border-white/18 p-3"}`}>
              <div className="space-y-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (compact) {
                        setMode("fixed");
                        setHoverExpanded(true);
                      }
                      setShowModeMenu((prev) => !prev);
                      setShowThemeMenu(false);
                    }}
                    className={`flex w-full items-center px-2 py-2 text-white transition duration-300 ${compact
                      ? "justify-center rounded-lg border-0 bg-transparent hover:bg-white/10"
                      : "rounded-xl border border-white/20 bg-white/8 hover:bg-white/14"
                      } ${expanded ? "gap-3" : "justify-center"
                      }`}
                  >
                    <span className="grid h-9 w-9 place-items-center text-[22px] leading-none">≡</span>
                    {expanded ? (
                      <>
                        <span className="text-sm">Modo sidebar</span>
                        <span className="ml-auto text-xs">⌄</span>
                      </>
                    ) : null}
                  </button>

                  {showModeMenu ? (
                    <div
                      className={`absolute z-30 rounded-xl border border-white/20 bg-slate-900/92 p-2 shadow-xl backdrop-blur-xl ${expanded ? "bottom-[calc(100%+8px)] left-0 right-0" : "bottom-0 left-[calc(100%+10px)] w-44"
                        }`}
                    >
                      {([
                        ["compact", "Compacta"],
                        ["auto", "Auto ocultable"],
                        ["fixed", "Fija"]
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setMode(value);
                            setShowModeMenu(false);
                          }}
                          className={`mt-1 w-full rounded-lg px-3 py-2 text-left text-sm transition first:mt-0 ${mode === value ? "bg-cyan-300/25 text-cyan-100" : "text-white/90 hover:bg-white/10"
                            }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (compact) {
                        setMode("fixed");
                        setHoverExpanded(true);
                      }
                      setShowThemeMenu((prev) => !prev);
                      setShowModeMenu(false);
                    }}
                    className={`flex w-full items-center px-2 py-2 text-white transition duration-300 ${compact
                      ? "justify-center rounded-lg border-0 bg-transparent hover:bg-white/10"
                      : "rounded-xl border border-white/20 bg-white/8 hover:bg-white/14"
                      } ${expanded ? "gap-3" : "justify-center"
                      }`}
                  >
                    <span className="grid h-9 w-9 place-items-center text-[22px] leading-none">◐</span>
                    {expanded ? (
                      <>
                        <span className="text-sm">Tema</span>
                        <span className="ml-auto text-xs">⌄</span>
                      </>
                    ) : null}
                  </button>

                  {showThemeMenu ? (
                    <div
                      className={`absolute z-30 rounded-xl border border-white/20 bg-slate-900/92 p-2 shadow-xl backdrop-blur-xl ${expanded ? "bottom-[calc(100%+8px)] left-0 right-0" : "bottom-0 left-[calc(100%+10px)] w-44"
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDarkPanel(true);
                          setShowThemeMenu(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${darkPanel ? "bg-cyan-300/25 text-cyan-100" : "text-white/90 hover:bg-white/10"
                          }`}
                      >
                        Oscuro degradado
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDarkPanel(false);
                          setShowThemeMenu(false);
                        }}
                        className={`mt-1 w-full rounded-lg px-3 py-2 text-left text-sm transition ${!darkPanel ? "bg-cyan-300/25 text-cyan-100" : "text-white/90 hover:bg-white/10"
                          }`}
                      >
                        Claro cristal
                      </button>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      localStorage.clear();
                    }
                    void signOut({ callbackUrl: `/${locale}` });
                  }}
                  className={`flex w-full items-center px-2 py-2 transition duration-300 ${compact
                    ? "justify-center rounded-lg border-0 bg-transparent text-rose-100 hover:bg-rose-300/20"
                    : "rounded-xl border border-rose-300/40 bg-rose-300/15 text-rose-100 hover:bg-rose-300/25"
                    } ${expanded ? "gap-3" : "justify-center"
                    }`}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-rose-300/20 text-[20px] leading-none">⎋</span>
                  {expanded ? <span className="text-sm font-semibold">Salir</span> : null}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="relative z-10 min-w-0 flex-1 p-2 md:p-2">
        <div id="contentSidebar" className="h-full overflow-hidden rounded-3xl border border-white/20 bg-white/16 p-2 backdrop-blur-md">


          {children ?? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Ventas Hoy", "$14,290", "+12%"],
                ["Pedidos Pendientes", "38", "-4"],
                ["Conversion", "4.8%", "+0.6"],
                ["Ticket Promedio", "$86", "+3%"],
                ["Clientes Activos", "1,204", "+18"],
                ["Incidencias", "2", "-1"]
              ].map(([metricTitle, value, delta]) => (
                <article key={metricTitle} className="rounded-2xl border border-white/25 bg-slate-950/30 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/65">{metricTitle}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                  <p className="mt-1 text-sm text-cyan-200">{delta}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
