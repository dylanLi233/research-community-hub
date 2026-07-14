CREATE TABLE `import_response_snapshots` (
	`import_request_id` text PRIMARY KEY NOT NULL,
	`response_data` text NOT NULL,
	FOREIGN KEY (`import_request_id`) REFERENCES `import_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
