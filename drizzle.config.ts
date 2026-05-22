import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit รันนอก Next.js → โหลด .env.local เอง
config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
