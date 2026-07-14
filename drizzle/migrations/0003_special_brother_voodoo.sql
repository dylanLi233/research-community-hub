CREATE TABLE `research_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`subtitle` text,
	`slug` text NOT NULL,
	`summary` text NOT NULL,
	`body_html` text NOT NULL,
	`access_level` text NOT NULL,
	`preview_mode` text NOT NULL,
	`source_institution` text NOT NULL,
	`source_report_date` text,
	`author_name` text,
	`cover_asset_id` text,
	`tags` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`rejection_reason` text,
	`published_at` integer,
	`scheduled_at` integer,
	`seo_title` text,
	`seo_description` text,
	`content_hash` text NOT NULL,
	`created_by_user_id` text,
	`imported_by_api_client_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`cover_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`imported_by_api_client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "research_reports_access_level_check" CHECK("research_reports"."access_level" in ('public', 'member', 'private')),
	CONSTRAINT "research_reports_preview_mode_check" CHECK("research_reports"."preview_mode" in ('none', 'paywall_marker', 'summary_only')),
	CONSTRAINT "research_reports_status_check" CHECK("research_reports"."status" in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
	CONSTRAINT "research_reports_access_preview_check" CHECK((
        ("research_reports"."access_level" in ('public', 'private') and "research_reports"."preview_mode" = 'none')
        or
        ("research_reports"."access_level" = 'member' and "research_reports"."preview_mode" in ('paywall_marker', 'summary_only'))
      )),
	CONSTRAINT "research_reports_title_length_check" CHECK(length("research_reports"."title") between 1 and 200),
	CONSTRAINT "research_reports_summary_length_check" CHECK(length("research_reports"."summary") between 1 and 2000),
	CONSTRAINT "research_reports_content_hash_length_check" CHECK(length("research_reports"."content_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_reports_slug_unique` ON `research_reports` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `research_reports_import_external_unique` ON `research_reports` (`imported_by_api_client_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `research_reports_status_published_at_idx` ON `research_reports` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `research_reports_access_status_idx` ON `research_reports` (`access_level`,`status`);--> statement-breakpoint
CREATE INDEX `research_reports_source_report_date_idx` ON `research_reports` (`source_report_date`);--> statement-breakpoint
CREATE INDEX `research_reports_content_hash_idx` ON `research_reports` (`content_hash`);--> statement-breakpoint
CREATE INDEX `research_reports_cover_asset_id_idx` ON `research_reports` (`cover_asset_id`);--> statement-breakpoint
CREATE INDEX `research_reports_created_by_user_id_idx` ON `research_reports` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `research_reports_deleted_at_idx` ON `research_reports` (`deleted_at`);