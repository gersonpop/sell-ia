"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import type {SettingModule} from "@/app/[locale]/(protect)/setting/layout";

function isImageIcon(value: string | null) {
  if (!value) return false;
  const icon = value.trim().toLowerCase();
  return icon.startsWith("data:image/") || icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/");
}

function normalizeTextIcon(value: string | null) {
  const icon = String(value ?? "").trim();
  if (icon.length === 1 || icon.length === 2) return icon;
  return "◦";
}

type EmbeddedPatternProps = {
  locale: string;
  parentTitle: string;
  items: SettingModule[];
  activeRoute?: string;
  children: React.ReactNode;
};

export function EmbeddedPattern({locale, parentTitle, items, activeRoute, children}: EmbeddedPatternProps) {
  const pathname = usePathname();
  const autoActiveRoute = `/${pathname.split("/").slice(2).join("/")}`;
  const resolvedActiveRoute = activeRoute ?? autoActiveRoute;

  return (
    <section className="grid h-full w-full gap-2 lg:grid-cols-12">
      <aside id="menuPanel" className="h-full w-full rounded-2xl border border-slate-200 bg-white p-2 ml-0 text-slate-700 lg:col-span-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{parentTitle}</h2>
        <nav className="mt-3 space-y-2">
          {items.length === 0 ? <p className="text-xs text-slate-500">No hay modulos hijos activos.</p> : null}
          {items.map((item) => {
            const href = `/${locale}${item.route}`;
            const active = item.route === resolvedActiveRoute;
            return (
              <Link
                key={item.id}
                href={href}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                  active ? "border-cyan-300 bg-cyan-50 text-cyan-900" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="grid h-5 w-5 place-items-center overflow-hidden rounded-sm text-base leading-none">
                  {isImageIcon(item.icon) ? <img src={item.icon ?? ""} alt="icon" className="h-4 w-4 object-contain" /> : normalizeTextIcon(item.icon)}
                </span>
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div id="contentPanel" className="h-full w-full rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 lg:col-span-9">
        {children}
      </div>
    </section>
  );
}
