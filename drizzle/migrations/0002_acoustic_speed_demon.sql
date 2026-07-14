CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`original_filename` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`alt_text` text,
	`access_level` text DEFAULT 'private' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`uploaded_by_user_id` text,
	`uploaded_by_api_client_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by_api_client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "assets_mime_type_check" CHECK("assets"."mime_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "assets_access_level_check" CHECK("assets"."access_level" in ('public', 'member', 'private')),
	CONSTRAINT "assets_status_check" CHECK("assets"."status" in ('active', 'deleted')),
	CONSTRAINT "assets_size_bytes_check" CHECK("assets"."size_bytes" > 0 and "assets"."size_bytes" <= 10485760)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_storage_key_unique` ON `assets` (`storage_key`);--> statement-breakpoint
CREATE INDEX `assets_created_at_idx` ON `assets` (`created_at`);--> statement-breakpoint
CREATE INDEX `assets_sha256_idx` ON `assets` (`sha256`);--> statement-breakpoint
CREATE INDEX `assets_access_status_idx` ON `assets` (`access_level`,`status`);--> statement-breakpoint
CREATE INDEX `assets_uploaded_by_user_id_idx` ON `assets` (`uploaded_by_user_id`);--> statement-breakpoint
CREATE INDEX `assets_uploaded_by_api_client_id_idx` ON `assets` (`uploaded_by_api_client_id`);