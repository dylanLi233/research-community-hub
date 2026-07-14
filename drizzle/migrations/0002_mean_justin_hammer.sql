CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`original_filename` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`extension` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`sha256` text NOT NULL,
	`alt_text` text,
	`source` text NOT NULL,
	`uploaded_by_user_id` text,
	`uploaded_by_api_client_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by_api_client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "assets_source_check" CHECK("assets"."source" in ('admin', 'api')),
	CONSTRAINT "assets_status_check" CHECK("assets"."status" in ('active', 'deleted')),
	CONSTRAINT "assets_size_bytes_check" CHECK("assets"."size_bytes" > 0),
	CONSTRAINT "assets_width_check" CHECK("assets"."width" > 0),
	CONSTRAINT "assets_height_check" CHECK("assets"."height" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_storage_key_unique` ON `assets` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_api_client_external_id_unique` ON `assets` (`uploaded_by_api_client_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `assets_status_created_at_idx` ON `assets` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `assets_sha256_idx` ON `assets` (`sha256`);--> statement-breakpoint
CREATE INDEX `assets_uploaded_by_user_id_idx` ON `assets` (`uploaded_by_user_id`);--> statement-breakpoint
CREATE INDEX `assets_uploaded_by_api_client_id_idx` ON `assets` (`uploaded_by_api_client_id`);