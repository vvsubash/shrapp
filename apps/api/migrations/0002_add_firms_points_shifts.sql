CREATE TABLE `firms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE TABLE `points` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL REFERENCES `firms`(`id`),
	`parent_point_id` text REFERENCES `points`(`id`),
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`shift_duration_hours` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`point_id` text NOT NULL REFERENCES `points`(`id`),
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `attendance` ADD COLUMN `point_id` text REFERENCES `points`(`id`);
--> statement-breakpoint
ALTER TABLE `attendance` ADD COLUMN `shift_id` text REFERENCES `shifts`(`id`);
--> statement-breakpoint
ALTER TABLE `extraction_rows` ADD COLUMN `matched_point_id` text REFERENCES `points`(`id`);
