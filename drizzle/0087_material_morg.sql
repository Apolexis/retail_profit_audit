ALTER TABLE `operational_request_print_settings` ADD `headingFontSize` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_request_print_settings` ADD `bodyFontSize` int DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_request_print_settings` ADD `totalFontSize` int DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_request_print_settings` ADD `headingBold` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_request_print_settings` ADD `bodyBold` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_request_print_settings` ADD `totalBold` boolean DEFAULT true NOT NULL;