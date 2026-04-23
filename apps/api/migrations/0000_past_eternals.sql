CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`location_id` text,
	`work_date` text NOT NULL,
	`extraction_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `work_locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`extraction_id`) REFERENCES `extractions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attendance_unique` ON `attendance` (`employee_id`,`work_date`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_emp_norm` ON `employees` (`name_normalized`);--> statement-breakpoint
CREATE TABLE `extraction_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`extraction_id` text NOT NULL,
	`row_num` integer,
	`name_raw` text,
	`location_raw` text,
	`matched_employee_id` text,
	`matched_location_id` text,
	`match_confidence` real,
	`user_action` text,
	FOREIGN KEY (`extraction_id`) REFERENCES `extractions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_location_id`) REFERENCES `work_locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`work_date` text NOT NULL,
	`ai_model` text NOT NULL,
	`raw_response` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`committed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `extractions_r2_key_unique` ON `extractions` (`r2_key`);--> statement-breakpoint
CREATE TABLE `work_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
