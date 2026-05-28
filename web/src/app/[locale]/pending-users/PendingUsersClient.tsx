"use client";

import {useState} from "react";

type PendingUser = {
  id: string;
  fullName: string;
  email: string;
  companyId: string;
  countryCode: string;
  dni: string;
  provider: string;
};

type Props = {
  initialPending: PendingUser[];
};

export function PendingUsersClient({initialPending}: Props) {
  const [items, setItems] = useState(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(userId: string, action: "approve" | "reject") {
    setBusyId(userId);
    setError(null);
    const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/${action}`, {
      method: "POST",
      headers: {"x-actor-id": "admin-ui"}
    });
    const data = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(data.message ?? "No fue posible ejecutar la accion");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== userId));
  }

  return (
    <div className="space-y-3">
      {items.map((user) => (
        <article key={user.id} className="rounded-xl border border-white/20 bg-slate-950/35 p-4 text-white">
          <p className="font-semibold">{user.fullName}</p>
          <p className="text-sm text-white/75">{user.email} - {user.companyId}</p>
          <p className="mt-1 text-xs text-white/60">{user.countryCode} / {user.dni} - {user.provider}</p>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busyId === user.id}
              onClick={() => void runAction(user.id, "approve")}
              className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-emerald-950 disabled:opacity-60"
            >
              Aprobar
            </button>
            <button
              disabled={busyId === user.id}
              onClick={() => void runAction(user.id, "reject")}
              className="rounded-lg bg-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-950 disabled:opacity-60"
            >
              Rechazar
            </button>
          </div>
        </article>
      ))}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {items.length === 0 ? <p className="text-white/75">No hay usuarios pendientes.</p> : null}
    </div>
  );
}
