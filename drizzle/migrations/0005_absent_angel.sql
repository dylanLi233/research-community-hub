ALTER TABLE `assets` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_api_client_external_id_unique` ON `assets` (`uploaded_by_api_client_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `assets_external_id_idx` ON `assets` (`external_id`);