CREATE TABLE `lead` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`verified_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_email_unique` ON `lead` (`email`);--> statement-breakpoint
CREATE TABLE `lead_verification` (
	`email` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_sent_at` integer NOT NULL
);
