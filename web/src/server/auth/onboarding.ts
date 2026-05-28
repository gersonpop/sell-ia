import {Pool} from "pg";

export type OnboardingStatus = "active" | "inactive" | "pending_approval";
export type ResolveFlow = "ACTIVE" | "FORM_REQUIRED" | "PENDING_ONLY" | "PROVIDER_CONFLICT";

type SocialProvider = "google" | "facebook" | "linkedin";

type UserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  companyId: string;
  countryCode: string;
  country: string;
  department: string;
  city: string;
  dni: string;
  birthDate: string;
  gender: string;
  status: OnboardingStatus;
  provider: SocialProvider;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingSubmitInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyId: string;
  countryCode: string;
  country: string;
  department: string;
  city: string;
  dni: string;
  birthDate: string;
  gender: string;
  provider: SocialProvider;
};

type CatalogDb = {
  companies: Array<{id: string; name: string}>;
  countries: Array<{code: string; label: string; prefixArea: string}>;
  departmentsByCountry: Record<string, Array<{code: string; label: string}>>;
  citiesByDepartment: Record<string, Array<{code: string; label: string}>>;
  multidataByGroup: Record<string, Array<{value: string; label: string}>>;
};

const defaultCatalogDb: CatalogDb = {
  companies: [
    {id: "company-generic-su", name: "Compania Generica SU"},
    {id: "company-demo-001", name: "Company Demo 001"}
  ],
  countries: [
    {code: "CO", label: "Colombia", prefixArea: "+57"},
    {code: "MX", label: "Mexico", prefixArea: "+52"}
  ],
  departmentsByCountry: {},
  citiesByDepartment: {},
  multidataByGroup: {
    gender: [
      {value: "male", label: "Masculino"},
      {value: "female", label: "Femenino"},
      {value: "other", label: "Otro"}
    ],
    countryCode: [
      {value: "+57", label: "+57"},
      {value: "+52", label: "+52"}
    ]
  }
};

const REQUIRED_USER_STATUS_VALUES = [
  {value: "active", label: "Activo"},
  {value: "inactive", label: "Inactivo"},
  {value: "pending_approval", label: "Pendiente de aprobacion"}
];

let pool: Pool | null = null;

function normalizePgConnectionString(raw: string) {
  try {
    const url = new URL(raw);
    const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
    const useLibpqCompat = url.searchParams.get("uselibpqcompat")?.toLowerCase() === "true";
    if (!useLibpqCompat && (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca")) {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }
    pool = new Pool({connectionString: normalizePgConnectionString(connectionString)});
  }
  return pool;
}

function normalizeStatus(status: string | null | undefined): OnboardingStatus {
  const raw = String(status ?? "").trim().toLowerCase();
  if (raw === "active") return "active";
  if (raw === "pending_approval") return "pending_approval";
  return "inactive";
}

function mapRowToUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id_user_pk),
    email: String(row.user_email),
    firstName: String(row.name ?? ""),
    lastName: String(row.last_name ?? ""),
    fullName: `${String(row.name ?? "")} ${String(row.last_name ?? "")}`.trim(),
    phone: String(row.phone_number ?? ""),
    companyId: String(row.companyId ?? ""),
    countryCode: String(row.country_code),
    country: String(row.country_iso ?? ""),
    department: String(row.department_code ?? ""),
    city: String(row.city_code ?? ""),
    dni: String(row.dni),
    birthDate: String(row.birth_date),
    gender: String(row.gender),
    status: normalizeStatus(String(row.status)),
    provider: String(row.provider ?? "google") as SocialProvider,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

async function ensureUserStatusCatalog() {
  const rows = await getPool().query('SELECT value FROM "st_Multidata" WHERE type=$1', ["userStatus"]);
  const existing = new Set(rows.rows.map((row) => String(row.value).toLowerCase()));

  for (const item of REQUIRED_USER_STATUS_VALUES) {
    if (!existing.has(item.value)) {
      await getPool().query(
        'INSERT INTO "st_Multidata" ("Initials_PK", name, value, type, "typeDescription", "typeUse", created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) ON CONFLICT (value, type) DO NOTHING',
        [item.value, item.label, item.value, "userStatus", "Estado de usuario onboarding", "Admin"]
      );
    }
  }
}


type CatalogCache = {
  data: CatalogDb;
  expiresAt: number;
} | null;

let catalogCache: CatalogCache = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateCatalogCache() {
  catalogCache = null;
}

async function readCatalogDb(): Promise<CatalogDb> {
  const now = Date.now();
  if (catalogCache && catalogCache.expiresAt > now) {
    return catalogCache.data;
  }

  try {
    const [companyRows, multidataRows, countryRows, stateRows, cityRows] = await Promise.all([
      getPool().query('SELECT id, "commercialName" FROM "Company" ORDER BY "commercialName" ASC'),
      getPool().query('SELECT name, value, type FROM "st_Multidata"'),
      getPool().query('SELECT prefix_area, iso, nombre FROM "st_Country"'),
      getPool().query('SELECT id_state, state, iso_country FROM "st_State"'),
      getPool().query('SELECT id_city, city, iso_country, state_id FROM "st_City"')
    ]);

    const rowsToStrings = (value: unknown) => String(value ?? "").trim();
    const countries = countryRows.rows
      .map((row) => {
        const prefixRaw = rowsToStrings(row.prefix_area);
        const prefixArea = prefixRaw.length > 0 ? `+${prefixRaw.replace(/^\+/, "")}` : "";
        return {code: rowsToStrings(row.iso), label: rowsToStrings(row.nombre), prefixArea};
      })
      .filter((row) => row.code.length > 0);

    const departmentsByCountry: Record<string, Array<{code: string; label: string}>> = {};
    for (const row of stateRows.rows) {
      const countryCode = rowsToStrings(row.iso_country);
      const code = rowsToStrings(row.id_state);
      const label = rowsToStrings(row.state);
      if (!countryCode || !code || !label) continue;
      departmentsByCountry[countryCode] ??= [];
      departmentsByCountry[countryCode].push({code, label});
    }

    const citiesByDepartment: Record<string, Array<{code: string; label: string}>> = {};
    for (const row of cityRows.rows) {
      const stateCode = rowsToStrings(row.state_id);
      const code = rowsToStrings(row.id_city);
      const label = rowsToStrings(row.city);
      if (!stateCode || !code || !label) continue;
      citiesByDepartment[stateCode] ??= [];
      citiesByDepartment[stateCode].push({code, label});
    }

    const multidataByGroup: Record<string, Array<{value: string; label: string}>> = {};
    for (const row of multidataRows.rows) {
      const group = rowsToStrings(row.type);
      const value = rowsToStrings(row.value);
      const label = rowsToStrings(row.name);
      if (!group || !value || !label) continue;
      multidataByGroup[group] ??= [];
      multidataByGroup[group].push({value, label});
    }

    const companies = companyRows.rows.map((row) => ({
      id: String(row.id),
      name: String(row.commercialName ?? row.id)
    }));

    const result: CatalogDb = {
      companies: companies.length > 0 ? companies : defaultCatalogDb.companies,
      countries: countries.length > 0 ? countries : defaultCatalogDb.countries,
      departmentsByCountry: Object.keys(departmentsByCountry).length > 0 ? departmentsByCountry : defaultCatalogDb.departmentsByCountry,
      citiesByDepartment: Object.keys(citiesByDepartment).length > 0 ? citiesByDepartment : defaultCatalogDb.citiesByDepartment,
      multidataByGroup: Object.keys(multidataByGroup).length > 0 ? multidataByGroup : defaultCatalogDb.multidataByGroup
    };

    catalogCache = {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS
    };

    return result;
  } catch {
    return defaultCatalogDb;
  }
}


function assertCatalogValue(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export async function getCatalogCompanies() {
  const db = await readCatalogDb();
  return db.companies;
}

export async function getCatalogCountries() {
  const db = await readCatalogDb();
  return db.countries;
}

export async function getCatalogDepartments(countryCode: string) {
  const db = await readCatalogDb();
  return db.departmentsByCountry[countryCode] ?? [];
}

export async function getCatalogCities(departmentCode: string, countryCode?: string) {
  const db = await readCatalogDb();
  const cities = db.citiesByDepartment[departmentCode] ?? [];
  if (!countryCode) return cities;
  const validDepartmentCodes = new Set((db.departmentsByCountry[countryCode] ?? []).map((item) => item.code));
  return validDepartmentCodes.has(departmentCode) ? cities : [];
}

export async function getCatalogMultidata(group: string) {
  const db = await readCatalogDb();
  return db.multidataByGroup[group] ?? [];
}

export async function resolveSocialOnboarding(email: string, provider: SocialProvider): Promise<{flow: ResolveFlow; user: UserRecord | null}> {
  await ensureUserStatusCatalog();
  const row = await getPool().query('SELECT * FROM "PlatformUser" WHERE lower("user_email")=lower($1) LIMIT 1', [email]);
  if ((row.rowCount ?? 0) === 0) {
    return {flow: "FORM_REQUIRED", user: null};
  }

  const user = mapRowToUser(row.rows[0]);
  if (user.provider !== provider) {
    return {flow: "PROVIDER_CONFLICT", user};
  }
  if (user.status === "pending_approval") {
    return {flow: "PENDING_ONLY", user};
  }
  if (user.status === "inactive") {
    return {flow: "FORM_REQUIRED", user};
  }
  return {flow: "ACTIVE", user};
}

export async function submitSocialOnboarding(input: OnboardingSubmitInput) {
  await ensureUserStatusCatalog();

  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedDni = input.dni.trim();
  const allRequired = [
    input.firstName,
    input.lastName,
    input.phone,
    input.companyId,
    input.countryCode,
    input.country,
    input.department,
    input.city,
    normalizedDni,
    input.birthDate,
    input.gender,
    normalizedEmail
  ].every((value) => value.trim().length > 0);
  if (!allRequired) {
    throw new Error("All required fields must be provided");
  }

  const catalogs = await readCatalogDb();
  const validCountryCodes = new Set<string>([
    ...(catalogs.multidataByGroup.countryCode ?? []).map((item) => item.value),
    ...catalogs.countries.map((item) => item.prefixArea)
  ]);
  assertCatalogValue(catalogs.companies.some((c) => c.id === input.companyId), "Invalid company");
  assertCatalogValue(validCountryCodes.has(input.countryCode), "Invalid country code");
  assertCatalogValue(catalogs.countries.some((item) => item.code === input.country), "Invalid country");
  assertCatalogValue((catalogs.departmentsByCountry[input.country] ?? []).some((item) => item.code === input.department), "Invalid department");
  assertCatalogValue((catalogs.citiesByDepartment[input.department] ?? []).some((item) => item.code === input.city), "Invalid city");
  assertCatalogValue((catalogs.multidataByGroup.gender ?? []).some((item) => item.value === input.gender), "Invalid gender");

  const duplicate = await getPool().query(
    'SELECT "id_user_pk" FROM "PlatformUser" WHERE "country_code"=$1 AND "dni"=$2 AND lower("user_email")<>lower($3) LIMIT 1',
    [input.countryCode, normalizedDni, normalizedEmail]
  );
  if ((duplicate.rowCount ?? 0) > 0) {
    throw new Error("DNI already exists for this country code");
  }

  const existingResult = await getPool().query('SELECT * FROM "PlatformUser" WHERE lower("user_email")=lower($1) LIMIT 1', [normalizedEmail]);
  const id = (existingResult.rowCount ?? 0) > 0 ? String(existingResult.rows[0].id_user_pk) : nextId("USR");
  const previousStatus = (existingResult.rowCount ?? 0) > 0 ? normalizeStatus(String(existingResult.rows[0].status)) : null;
  const previousProvider = (existingResult.rowCount ?? 0) > 0 ? String(existingResult.rows[0].provider) : null;

  if (previousProvider && previousProvider !== input.provider) {
    throw new Error(`User already linked with provider ${previousProvider}`);
  }

  await getPool().query(
    `
      INSERT INTO "PlatformUser" (
        "id_user_pk","user_email","username","name","last_name","phone_number","companyId","country_code","country_iso","department_code","city_code","dni","birth_date","gender","status","provider","created_at","updated_at"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW()
      )
      ON CONFLICT ("user_email")
      DO UPDATE SET
        "name"=EXCLUDED."name",
        "last_name"=EXCLUDED."last_name",
        "phone_number"=EXCLUDED."phone_number",
        "companyId"=EXCLUDED."companyId",
        "country_code"=EXCLUDED."country_code",
        "country_iso"=EXCLUDED."country_iso",
        "department_code"=EXCLUDED."department_code",
        "city_code"=EXCLUDED."city_code",
        "dni"=EXCLUDED."dni",
        "birth_date"=EXCLUDED."birth_date",
        "gender"=EXCLUDED."gender",
        "status"=EXCLUDED."status",
        "provider"=EXCLUDED."provider",
        "updated_at"=NOW()
    `,
    [
      id,
      normalizedEmail,
      normalizedEmail,
      input.firstName,
      input.lastName,
      input.phone,
      input.companyId,
      input.countryCode,
      input.country,
      input.department,
      input.city,
      normalizedDni,
      input.birthDate,
      input.gender,
      "pending_approval",
      input.provider
    ]
  );

  await getPool().query(
    `INSERT INTO "AuditLog" (id,"actorType","actorId",action,entity,"entityId",metadata,"createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())`,
    [
      nextId("ONAUDIT"),
      "system",
      normalizedEmail,
      (existingResult.rowCount ?? 0) > 0 ? "update-onboarding" : "create-onboarding",
      "PlatformUser",
      id,
      JSON.stringify({provider: input.provider, fromStatus: previousStatus, toStatus: "pending_approval"})
    ]
  );

  const saved = await getPool().query('SELECT * FROM "PlatformUser" WHERE "id_user_pk"=$1', [id]);
  return mapRowToUser(saved.rows[0]);
}

export async function listPendingApprovals() {
  await ensureUserStatusCatalog();
  const rows = await getPool().query('SELECT * FROM "PlatformUser" WHERE "status"=$1 ORDER BY "created_at" DESC', ["pending_approval"]);
  return rows.rows.map(mapRowToUser);
}

export async function updateApprovalStatus(userId: string, actor: string, action: "approve" | "reject") {
  await ensureUserStatusCatalog();
  const nextStatus: OnboardingStatus = action === "approve" ? "active" : "inactive";
  const current = await getPool().query('SELECT * FROM "PlatformUser" WHERE "id_user_pk"=$1 LIMIT 1', [userId]);
  if ((current.rowCount ?? 0) === 0) {
    throw new Error("User not found");
  }

  await getPool().query('UPDATE "PlatformUser" SET "status"=$1, "updated_at"=NOW() WHERE "id_user_pk"=$2', [nextStatus, userId]);
  await getPool().query(
    `INSERT INTO "AuditLog" (id,"actorType","actorId",action,entity,"entityId",metadata,"createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())`,
    [
      nextId("ONAUDIT"),
      "system",
      actor,
      action === "approve" ? "approve-user" : "reject-user",
      "PlatformUser",
      userId,
      JSON.stringify({fromStatus: normalizeStatus(String(current.rows[0].status)), toStatus: nextStatus})
    ]
  );

  const updated = await getPool().query('SELECT * FROM "PlatformUser" WHERE "id_user_pk"=$1', [userId]);
  return mapRowToUser(updated.rows[0]);
}
