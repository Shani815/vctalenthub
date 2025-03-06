import * as schema from "@/db/schema";

import { drizzle } from "drizzle-orm/neon-serverless";
import env from "@/server/config/env";
import ws from "ws";

const DATABASE_URL = env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

let db;

try {
  db = drizzle({
    connection: DATABASE_URL,
    schema,
    ws: ws,
  });
} catch (error) {
  console.error("Failed to initialize database connection:", error);
  throw error;
}

export { db };
