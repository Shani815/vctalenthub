import * as dotenv from "dotenv";

import { defineConfig } from "drizzle-kit";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  out: "./migrations",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
