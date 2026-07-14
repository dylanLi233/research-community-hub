import { relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { importRequests } from "./schema";

export const importResponseSnapshots = sqliteTable("import_response_snapshots", {
  importRequestId: text("import_request_id")
    .primaryKey()
    .references(() => importRequests.id, { onDelete: "cascade" }),
  responseData: text("response_data", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
});

export const importResponseSnapshotsRelations = relations(
  importResponseSnapshots,
  ({ one }) => ({
    request: one(importRequests, {
      fields: [importResponseSnapshots.importRequestId],
      references: [importRequests.id],
    }),
  }),
);

export type ImportResponseSnapshot = typeof importResponseSnapshots.$inferSelect;
