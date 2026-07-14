CREATE TABLE `api_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`scopes` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "api_clients_status_check" CHECK("api_clients"."status" in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_clients_name_unique` ON `api_clients` (`name`);--> statement-breakpoint
CREATE INDEX `api_clients_status_idx` ON `api_clients` (`status`);--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "api_tokens_status_check" CHECK("api_tokens"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_tokens_client_id_idx` ON `api_tokens` (`client_id`);--> statement-breakpoint
CREATE INDEX `api_tokens_status_expires_at_idx` ON `api_tokens` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by_user_id` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `app_settings_updated_by_user_id_idx` ON `app_settings` (`updated_by_user_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "audit_logs_actor_type_check" CHECK("audit_logs"."actor_type" in ('user', 'api', 'system'))
);
--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_type`,`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `import_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`api_client_id` text,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`endpoint` text NOT NULL,
	`external_id` text,
	`content_type` text,
	`result` text NOT NULL,
	`http_status` integer NOT NULL,
	`error_code` text,
	`resource_type` text,
	`resource_id` text,
	`duration_ms` integer,
	`source_ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`api_client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "import_requests_result_check" CHECK("import_requests"."result" in ('success', 'warning', 'failure'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_requests_client_idempotency_unique` ON `import_requests` (`api_client_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `import_requests_created_at_idx` ON `import_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `import_requests_external_id_idx` ON `import_requests` (`external_id`);--> statement-breakpoint
CREATE INDEX `import_requests_result_idx` ON `import_requests` (`result`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`starts_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memberships_status_check" CHECK("memberships"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_user_id_unique` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_status_expires_at_idx` ON `memberships` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`username_normalized` text NOT NULL,
	`display_name` text,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`password_changed_at` integer,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" in ('member', 'admin')),
	CONSTRAINT "users_status_check" CHECK("users"."status" in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_normalized_unique` ON `users` (`username_normalized`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);
