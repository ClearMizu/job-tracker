CREATE TABLE `job_application` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`url` text,
	`status` text DEFAULT 'saved' NOT NULL,
	`notes` text,
	`applied_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_application_user_idx` ON `job_application` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `job_application_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`changed_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `job_application`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `status_history_app_idx` ON `job_application_status_history` (`application_id`,`changed_at`);