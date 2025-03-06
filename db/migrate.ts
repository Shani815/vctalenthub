import { drizzle } from "drizzle-orm/neon-serverless";
import env from "@/server/config/env";
import fs from 'fs';
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import path from 'path';
import ws from "ws";

// Initialize the database connection
const db = drizzle({
  connection: env.DATABASE_URL,
  ws: ws,
});

// Run migrations
async function main() {
  console.log("Running migrations...");
  
  try {
    // Read and execute the drop types script first
    const dropTypesScript = fs.readFileSync(
      path.join(process.cwd(), 'migrations', '0000_drop_types.sql'),
      'utf8'
    );
    
    // Execute the drop types script
    console.log("Dropping existing types...");
    await db.execute(dropTypesScript);
    console.log("Types dropped successfully");

    // Run the main migration
    console.log("Running main migration...");
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

main(); 