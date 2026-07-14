CREATE TABLE `auth_rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL,
	`blocked_until` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "auth_rate_limits_failure_count_check" CHECK("auth_rate_limits"."failure_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limits_blocked_until_idx` ON `auth_rate_limits` (`blocked_until`);--> statement-breakpoint
CREATE INDEX `auth_rate_limits_updated_at_idx` ON `auth_rate_limits` (`updated_at`);
