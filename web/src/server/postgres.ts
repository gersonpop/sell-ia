import {Pool} from "pg";

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

export function getPgPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }
    pool = new Pool({connectionString: normalizePgConnectionString(connectionString)});
  }
  return pool;
}
