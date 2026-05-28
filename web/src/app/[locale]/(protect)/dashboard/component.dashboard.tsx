"use client";

export function DynamicComponent() {
  return (
    <section className="space-y-4">
      <p className="text-sm text-slate-600">Este módulo se ha creado dinámicamente con contenido básico.</p>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <h2 className="text-base font-semibold text-slate-800">Contenido básico</h2>
        <p className="mt-1 text-xs text-slate-500">Puedes editar este componente en `component.dashboard.tsx` para agregar tu lógica de negocio.</p>
      </div>
    </section>
  );
}

export default DynamicComponent;