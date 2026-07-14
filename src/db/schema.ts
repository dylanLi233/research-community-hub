import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const nowMs = sql`(unixepoch() * 1000)`;
const timestampMs = (name: string) => integer(name, { mode: "timestamp_ms" });

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    usernameNormalized: text("username_normalized").notNull(),
    displayName: text("display_name"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["member", "admin"] })
      .notNull()
      .default("member"),
    status: text("status", { enum: ["active", "disabled"] })
      .notNull()
      .default("active"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(true),
    passwordChangedAt: timestampMs("password_changed_at"),
    lastLoginAt: timestampMs("last_login_at"),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
    updatedAt: timestampMs("updated_at").notNull().default(nowMs),
  },
  (table) => [
    uniqueIndex("users_username_normalized_unique").on(
      table.usernameNormalized,
    ),
    index("users_status_idx").on(table.status),
    check("users_role_check", sql`${table.role} in ('member', 'admin')`),
    check(
      "users_status_check",
      sql`${table.status} in ('active', 'disabled')`,
    ),
  ],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "inactive"] })
      .notNull()
      .default("active"),
    startsAt: timestampMs("starts_at").notNull().default(nowMs),
    expiresAt: timestampMs("expires_at"),
    source: text("source").notNull().default("manual"),
    note: text("note"),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
    updatedAt: timestampMs("updated_at").notNull().default(nowMs),
  },
  (table) => [
    uniqueIndex("memberships_user_id_unique").on(table.userId),
    index("memberships_status_expires_at_idx").on(
      table.status,
      table.expiresAt,
    ),
    check(
      "memberships_status_check",
      sql`${table.status} in ('active', 'inactive')`,
    ),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestampMs("expires_at").notNull(),
    lastSeenAt: timestampMs("last_seen_at"),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
    revokedAt: timestampMs("revoked_at"),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const authRateLimits = sqliteTable(
  "auth_rate_limits",
  {
    keyHash: text("key_hash").primaryKey(),
    failureCount: integer("failure_count").notNull().default(0),
    windowStartedAt: timestampMs("window_started_at").notNull(),
    blockedUntil: timestampMs("blocked_until"),
    updatedAt: timestampMs("updated_at").notNull().default(nowMs),
  },
  (table) => [
    index("auth_rate_limits_blocked_until_idx").on(table.blockedUntil),
    index("auth_rate_limits_updated_at_idx").on(table.updatedAt),
    check(
      "auth_rate_limits_failure_count_check",
      sql`${table.failureCount} >= 0`,
    ),
  ],
);

export const appSettings = sqliteTable(
  "app_settings",
  {
    key: text("key").primaryKey(),
    value: text("value", { mode: "json" }).$type<unknown>().notNull(),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestampMs("updated_at").notNull().default(nowMs),
  },
  (table) => [index("app_settings_updated_by_user_id_idx").on(table.updatedByUserId)],
);

export const apiClients = sqliteTable(
  "api_clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status", { enum: ["active", "disabled"] })
      .notNull()
      .default("active"),
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
    updatedAt: timestampMs("updated_at").notNull().default(nowMs),
  },
  (table) => [
    uniqueIndex("api_clients_name_unique").on(table.name),
    index("api_clients_status_idx").on(table.status),
    check(
      "api_clients_status_check",
      sql`${table.status} in ('active', 'disabled')`,
    ),
  ],
);

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => apiClients.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    status: text("status", { enum: ["active", "revoked"] })
      .notNull()
      .default("active"),
    expiresAt: timestampMs("expires_at"),
    lastUsedAt: timestampMs("last_used_at"),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
    revokedAt: timestampMs("revoked_at"),
  },
  (table) => [
    uniqueIndex("api_tokens_token_hash_unique").on(table.tokenHash),
    index("api_tokens_client_id_idx").on(table.clientId),
    index("api_tokens_status_expires_at_idx").on(
      table.status,
      table.expiresAt,
    ),
    check(
      "api_tokens_status_check",
      sql`${table.status} in ('active', 'revoked')`,
    ),
  ],
);

export const importRequests = sqliteTable(
  "import_requests",
  {
    id: text("id").primaryKey(),
    apiClientId: text("api_client_id").references(() => apiClients.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    endpoint: text("endpoint").notNull(),
    externalId: text("external_id"),
    contentType: text("content_type"),
    result: text("result", { enum: ["success", "warning", "failure"] })
      .notNull(),
    httpStatus: integer("http_status").notNull(),
    errorCode: text("error_code"),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    durationMs: integer("duration_ms"),
    sourceIpHash: text("source_ip_hash"),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
  },
  (table) => [
    uniqueIndex("import_requests_client_idempotency_unique").on(
      table.apiClientId,
      table.idempotencyKey,
    ),
    index("import_requests_created_at_idx").on(table.createdAt),
    index("import_requests_external_id_idx").on(table.externalId),
    index("import_requests_result_idx").on(table.result),
    check(
      "import_requests_result_check",
      sql`${table.result} in ('success', 'warning', 'failure')`,
    ),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorType: text("actor_type", { enum: ["user", "api", "system"] })
      .notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: text("metadata", { mode: "json" }).$type<unknown>(),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorType, table.actorId),
    index("audit_logs_resource_idx").on(
      table.resourceType,
      table.resourceId,
    ),
    index("audit_logs_created_at_idx").on(table.createdAt),
    check(
      "audit_logs_actor_type_check",
      sql`${table.actorType} in ('user', 'api', 'system')`,
    ),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  membership: one(memberships, {
    fields: [users.id],
    references: [memberships.userId],
  }),
  sessions: many(sessions),
  settingsUpdates: many(appSettings),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const appSettingsRelations = relations(appSettings, ({ one }) => ({
  updatedBy: one(users, {
    fields: [appSettings.updatedByUserId],
    references: [users.id],
  }),
}));

export const apiClientsRelations = relations(apiClients, ({ many }) => ({
  tokens: many(apiTokens),
  importRequests: many(importRequests),
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  client: one(apiClients, {
    fields: [apiTokens.clientId],
    references: [apiClients.id],
  }),
}));

export const importRequestsRelations = relations(importRequests, ({ one }) => ({
  client: one(apiClients, {
    fields: [importRequests.apiClientId],
    references: [apiClients.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type AuthRateLimit = typeof authRateLimits.$inferSelect;
export type ApiClient = typeof apiClients.$inferSelect;
export type NewApiClient = typeof apiClients.$inferInsert;
export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
