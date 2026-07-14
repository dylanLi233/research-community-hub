CREATE TABLE `market_events` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`event_date` text NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`category` text NOT NULL,
	`importance` text DEFAULT 'medium' NOT NULL,
	`region` text,
	`summary` text NOT NULL,
	`impact` text,
	`focus_points` text NOT NULL,
	`source_name` text,
	`source_url` text,
	`tags` text NOT NULL,
	`access_level` text DEFAULT 'public' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`rejection_reason` text,
	`published_at` integer,
	`content_hash` text NOT NULL,
	`created_by_user_id` text,
	`imported_by_api_client_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`imported_by_api_client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "market_events_category_check" CHECK("market_events"."category" in ('macro', 'policy', 'central_bank', 'economic_data', 'industry', 'company', 'earnings', 'market', 'geopolitics', 'other')),
	CONSTRAINT "market_events_importance_check" CHECK("market_events"."importance" in ('high', 'medium', 'low')),
	CONSTRAINT "market_events_access_level_check" CHECK("market_events"."access_level" in ('public', 'member', 'private')),
	CONSTRAINT "market_events_status_check" CHECK("market_events"."status" in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
	CONSTRAINT "market_events_all_day_time_check" CHECK(("market_events"."all_day" = 0) or ("market_events"."starts_at" is null and "market_events"."ends_at" is null)),
	CONSTRAINT "market_events_time_range_check" CHECK("market_events"."ends_at" is null or ("market_events"."starts_at" is not null and "market_events"."ends_at" > "market_events"."starts_at")),
	CONSTRAINT "market_events_content_hash_length_check" CHECK(length("market_events"."content_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_events_import_external_unique` ON `market_events` (`imported_by_api_client_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `market_events_date_status_idx` ON `market_events` (`event_date`,`status`);--> statement-breakpoint
CREATE INDEX `market_events_starts_at_idx` ON `market_events` (`starts_at`);--> statement-breakpoint
CREATE INDEX `market_events_category_date_idx` ON `market_events` (`category`,`event_date`);--> statement-breakpoint
CREATE INDEX `market_events_importance_date_idx` ON `market_events` (`importance`,`event_date`);--> statement-breakpoint
CREATE INDEX `market_events_access_status_idx` ON `market_events` (`access_level`,`status`);--> statement-breakpoint
CREATE INDEX `market_events_content_hash_idx` ON `market_events` (`content_hash`);--> statement-breakpoint
CREATE INDEX `market_events_created_by_user_id_idx` ON `market_events` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `market_events_deleted_at_idx` ON `market_events` (`deleted_at`);