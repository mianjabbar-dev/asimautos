import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Ensure the local Dev Server HMR doesn't blow up connection pool
const globalForDb = globalThis as unknown as { __pgPool?: Pool };

const pool =
  globalForDb.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Increased timeouts to prevent local ETIMEDOUT during heavy loads
    max: 15,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Add SSL to ensure Neon connects securely if not specified in URL
    ssl: {
      rejectUnauthorized: false
    }
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgPool = pool;
}

export const db = drizzle(pool, { schema });
export type Db = typeof db;