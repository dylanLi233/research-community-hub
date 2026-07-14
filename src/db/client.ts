import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as assetSchema from "./assets-schema";
import * as coreSchema from "./schema";
import * as importSchema from "./import-schema";
import * as reportSchema from "./reports-schema";

const schema = {
  ...coreSchema,
  ...assetSchema,
  ...reportSchema,
  ...importSchema,
};

export function createDb(binding: D1Database) {
  return drizzle(binding, { schema });
}

export type AppDatabase = ReturnType<typeof createDb>;

export async function getDb(): Promise<AppDatabase> {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.DB) {
    throw new Error("Cloudflare D1 binding DB is not configured");
  }

  return createDb(env.DB);
}
