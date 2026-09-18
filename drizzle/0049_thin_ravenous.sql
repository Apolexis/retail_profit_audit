CREATE TABLE `operational_store_request_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`slot` int NOT NULL,
	`printCategoryGroupId` int NOT NULL,
	`printCategoryGroupName` varchar(128) NOT NULL,
	`text` varchar(2000) NOT NULL,
	`createdByAccountId` int NOT NULL,
	`updatedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_store_request_comments_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_store_request_comment_slot_uq` UNIQUE(`requestId`,`slot`)
);
