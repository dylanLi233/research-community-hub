CREATE TABLE `course_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text NOT NULL,
	`body_html` text NOT NULL,
	`access_level` text NOT NULL,
	`preview_mode` text NOT NULL,
	`position` integer NOT NULL,
	`estimated_minutes` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`rejection_reason` text,
	`published_at` integer,
	`content_hash` text NOT NULL,
	`created_by_user_id` text,
	`imported_by_api_client_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`imported_by_api_client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "course_chapters_access_level_check" CHECK("course_chapters"."access_level" in ('public', 'member', 'private')),
	CONSTRAINT "course_chapters_preview_mode_check" CHECK("course_chapters"."preview_mode" in ('none', 'paywall_marker', 'summary_only')),
	CONSTRAINT "course_chapters_status_check" CHECK("course_chapters"."status" in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
	CONSTRAINT "course_chapters_access_preview_check" CHECK((
        ("course_chapters"."access_level" in ('public', 'private') and "course_chapters"."preview_mode" = 'none')
        or
        ("course_chapters"."access_level" = 'member' and "course_chapters"."preview_mode" in ('paywall_marker', 'summary_only'))
      )),
	CONSTRAINT "course_chapters_position_check" CHECK("course_chapters"."position" between 1 and 9999),
	CONSTRAINT "course_chapters_estimated_minutes_check" CHECK("course_chapters"."estimated_minutes" is null or "course_chapters"."estimated_minutes" between 1 and 600),
	CONSTRAINT "course_chapters_content_hash_length_check" CHECK(length("course_chapters"."content_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_chapters_course_slug_unique` ON `course_chapters` (`course_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_chapters_course_external_unique` ON `course_chapters` (`course_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `course_chapters_course_position_idx` ON `course_chapters` (`course_id`,`position`,`created_at`);--> statement-breakpoint
CREATE INDEX `course_chapters_course_status_idx` ON `course_chapters` (`course_id`,`status`);--> statement-breakpoint
CREATE INDEX `course_chapters_access_status_idx` ON `course_chapters` (`access_level`,`status`);--> statement-breakpoint
CREATE INDEX `course_chapters_content_hash_idx` ON `course_chapters` (`content_hash`);--> statement-breakpoint
CREATE INDEX `course_chapters_created_by_user_id_idx` ON `course_chapters` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `course_chapters_deleted_at_idx` ON `course_chapters` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`subtitle` text,
	`slug` text NOT NULL,
	`summary` text NOT NULL,
	`description_html` text NOT NULL,
	`cover_asset_id` text,
	`instructor_name` text,
	`tags` text NOT NULL,
	`access_level` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`rejection_reason` text,
	`published_at` integer,
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
	CONSTRAINT "courses_access_level_check" CHECK("courses"."access_level" in ('public', 'member', 'private')),
	CONSTRAINT "courses_status_check" CHECK("courses"."status" in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
	CONSTRAINT "courses_title_length_check" CHECK(length("courses"."title") between 1 and 200),
	CONSTRAINT "courses_summary_length_check" CHECK(length("courses"."summary") between 1 and 2000),
	CONSTRAINT "courses_content_hash_length_check" CHECK(length("courses"."content_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_slug_unique` ON `courses` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `courses_import_external_unique` ON `courses` (`imported_by_api_client_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `courses_status_published_at_idx` ON `courses` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `courses_access_status_idx` ON `courses` (`access_level`,`status`);--> statement-breakpoint
CREATE INDEX `courses_cover_asset_id_idx` ON `courses` (`cover_asset_id`);--> statement-breakpoint
CREATE INDEX `courses_content_hash_idx` ON `courses` (`content_hash`);--> statement-breakpoint
CREATE INDEX `courses_created_by_user_id_idx` ON `courses` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `courses_deleted_at_idx` ON `courses` (`deleted_at`);