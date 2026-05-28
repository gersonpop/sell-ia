"use client";

import {useEffect, useMemo, useState} from "react";

type Props = {
  locale: string;
  email: string;
  provider: "google" | "facebook" | "linkedin";
  defaultFullName: string;
};

export function OnboardingClient({locale, email, provider, defaultFullName}: Props) {
  const [companies, setCompanies] = useState<Array<{id: string; name: string}>>([]);
  const [genders, setGenders] = useState<Array<{value: string; label: string}>>([]);
  const [countries, setCountries] = useState<Array<{code: string; label: string; prefixArea?: string}>>([]);
  const [departments, setDepartments] = useState<Array<{code: string; label: string}>>([]);
  const [cities, setCities] = useState<Array<{code: string; label: string}>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const defaultNameParts = defaultFullName.trim().split(/\s+/).filter(Boolean);
  const defaultFirstName = defaultNameParts.slice(0, 1).join(" ");
  const defaultLastName = defaultNameParts.slice(1).join(" ");

  const [form, setForm] = useState({
    firstName: defaultFirstName,
    lastName: defaultLastName,
    phone: "",
    companyId: "",
    countryCode: "",
    country: "",
    department: "",
    city: "",
    dni: "",
    birthDate: "",
    gender: ""
  });

  useEffect(() => {
    async function loadBaseCatalogs() {
      const cacheKey = "onboarding_bootstrap";
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            setCompanies(data.companies ?? []);
            setGenders(data.genders ?? []);
            setCountries(data.countries ?? []);
            return;
          } catch {
            // Ignore parse error
          }
        }
      }

      const response = await fetch("/api/v1/auth/social/onboarding/bootstrap");
      const data = await response.json();

      const uniqueByValue = <T extends {value: string}>(items: T[]) => {
        const seen = new Set<string>();
        return items.filter((item) => {
          if (seen.has(item.value)) return false;
          seen.add(item.value);
          return true;
        });
      };

      const rawGenders = (data.genders ?? []) as Array<{value: string; label: string}>;
      const finalGenders = uniqueByValue(rawGenders);
      setCompanies(data.companies ?? []);
      setGenders(finalGenders);
      setCountries(data.countries ?? []);

      if (typeof window !== "undefined") {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            companies: data.companies ?? [],
            genders: finalGenders,
            countries: data.countries ?? []
          })
        );
      }
    }
    void loadBaseCatalogs();
  }, []);

  useEffect(() => {
    if (!form.country) {
      return;
    }
    async function loadDepartments() {
      const cacheKey = `onboarding_deps_${form.country}`;
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            setDepartments(data ?? []);
            return;
          } catch {
            // Ignore parse error
          }
        }
      }

      const response = await fetch(`/api/v1/auth/social/onboarding/departments?countryCode=${encodeURIComponent(form.country)}`);
      const data = await response.json();
      const items = data.items ?? [];
      setDepartments(items);

      if (typeof window !== "undefined") {
        localStorage.setItem(cacheKey, JSON.stringify(items));
      }
    }
    void loadDepartments();
  }, [form.country]);

  useEffect(() => {
    if (!form.department) {
      return;
    }
    async function loadCities() {
      const cacheKey = `onboarding_cities_${form.country}_${form.department}`;
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            setCities(data ?? []);
            return;
          } catch {
            // Ignore parse error
          }
        }
      }

      const response = await fetch(
        `/api/v1/auth/social/onboarding/cities?countryCode=${encodeURIComponent(form.country)}&departmentCode=${encodeURIComponent(form.department)}`
      );
      const data = await response.json();
      const items = data.items ?? [];
      setCities(items);

      if (typeof window !== "undefined") {
        localStorage.setItem(cacheKey, JSON.stringify(items));
      }
    }
    void loadCities();
  }, [form.country, form.department]);

  const valid = useMemo(
    () =>
      [
        form.firstName,
        form.lastName,
        form.phone,
        form.companyId,
        form.countryCode,
        form.country,
        form.department,
        form.city,
        form.dni,
        form.birthDate,
        form.gender
      ].every((value) => value.trim().length > 0),
    [form]
  );

  async function submit() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/v1/auth/social/onboarding/submit", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        email,
        provider,
        ...form,
        phone: `${form.countryCode}${form.phone}`
      })
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(data.message ?? "No fue posible guardar");
      return;
    }

    window.location.href = `/${locale}/pending-approval`;
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md">
        <h1 className="text-2xl font-semibold">Completa tu registro</h1>
        <p className="mt-1 text-sm text-white/75">Tu cuenta quedara en revision hasta que un administrador la apruebe.</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input value={form.firstName} onChange={(e) => setForm((p) => ({...p, firstName: e.target.value}))} className="rounded-lg bg-white/90 px-3 py-2 text-slate-900" placeholder="Nombres" />
          <input value={form.lastName} onChange={(e) => setForm((p) => ({...p, lastName: e.target.value}))} className="rounded-lg bg-white/90 px-3 py-2 text-slate-900" placeholder="Apellidos" />
          <select value={form.companyId} onChange={(e) => setForm((p) => ({...p, companyId: e.target.value}))} className="rounded-lg bg-white/90 px-3 py-2 text-slate-900">
            <option value="">Empresa</option>
            {companies.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select
            value={form.country}
            onChange={(e) => {
              const nextCountry = e.target.value;
              const selectedCountry = countries.find((item) => item.code === nextCountry);
              setDepartments([]);
              setCities([]);
              setForm((p) => ({
                ...p,
                country: nextCountry,
                countryCode: selectedCountry?.prefixArea ?? p.countryCode,
                department: "",
                city: ""
              }));
            }}
            className="rounded-lg bg-white/90 px-3 py-2 text-slate-900"
          >
            <option value="">Pais</option>
            {countries.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
          <select
            value={form.department}
            onChange={(e) => {
              setCities([]);
              setForm((p) => ({...p, department: e.target.value, city: ""}));
            }}
            className="rounded-lg bg-white/90 px-3 py-2 text-slate-900"
          >
            <option value="">Estado/Provincia</option>
            {departments.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
          <select value={form.city} onChange={(e) => setForm((p) => ({...p, city: e.target.value}))} className="rounded-lg bg-white/90 px-3 py-2 text-slate-900">
            <option value="">Ciudad</option>
            {cities.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <input
              value={form.countryCode}
              readOnly
              className="rounded-lg bg-slate-200 px-3 py-2 text-slate-900"
              placeholder="Codigo"
            />
            <input value={form.phone} onChange={(e) => setForm((p) => ({...p, phone: e.target.value.replace(/\D/g, "")}))} className="rounded-lg bg-white/90 px-3 py-2 text-slate-900" placeholder="Telefono" />
          </div>
          <input value={form.birthDate} onChange={(e) => setForm((p) => ({...p, birthDate: e.target.value}))} type="date" className="rounded-lg bg-white/90 px-3 py-2 text-slate-900" />
          <input
            value={form.dni}
            onChange={(e) => setForm((p) => ({...p, dni: e.target.value}))}
            className="rounded-lg bg-white/90 px-3 py-2 text-slate-900"
            placeholder="DNI"
          />
          <select value={form.gender} onChange={(e) => setForm((p) => ({...p, gender: e.target.value}))} className="rounded-lg bg-white/90 px-3 py-2 text-slate-900">
            <option value="">Genero</option>
            {genders.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

        <button disabled={!valid || saving} onClick={() => void submit()} className="mt-5 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:bg-slate-500">
          {saving ? "Guardando..." : "Guardar y enviar a revision"}
        </button>
      </section>
    </main>
  );
}
