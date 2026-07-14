import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: [
    "./src/db/schema.ts",
    "./src/db/assets-schema.ts",
    "./src/db/reports-schema.ts",
    "./src/db/import-schema.ts",
  ],
  out: "./drizzle/migrations",
  strict: true,
  verbose: true,
});
