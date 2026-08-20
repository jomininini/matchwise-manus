CREATE TABLE `datasetImports` (
	`id` varchar(96) NOT NULL,
	`sourceType` enum('company','solution','investor') NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`fileKey` varchar(1024),
	`recordCount` int NOT NULL DEFAULT 0,
	`status` enum('processing','ready','failed') NOT NULL DEFAULT 'processing',
	`errorMessage` text,
	`importedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `datasetImports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` varchar(96) NOT NULL,
	`sourceType` enum('company','solution','investor') NOT NULL,
	`recordKey` varchar(160) NOT NULL,
	`name` text NOT NULL,
	`website` varchar(2048),
	`sector` varchar(255),
	`stage` varchar(255),
	`technology` mediumtext,
	`description` mediumtext,
	`investmentFocus` mediumtext,
	`ticketSize` varchar(255),
	`portfolio` mediumtext,
	`normalizedText` mediumtext NOT NULL,
	`rawData` json NOT NULL,
	`importBatchId` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_source_record_unique` UNIQUE(`sourceType`,`recordKey`)
);
--> statement-breakpoint
CREATE TABLE `savedItems` (
	`id` varchar(96) NOT NULL,
	`userId` int NOT NULL,
	`itemType` enum('profile','match') NOT NULL,
	`profileId` varchar(96),
	`sourceProfileId` varchar(96),
	`targetProfileId` varchar(96),
	`matchScore` int,
	`matchSummary` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `savedItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_profile_per_user_unique` UNIQUE(`userId`,`profileId`)
);
--> statement-breakpoint
CREATE INDEX `profiles_source_idx` ON `profiles` (`sourceType`);--> statement-breakpoint
CREATE INDEX `profiles_import_batch_idx` ON `profiles` (`importBatchId`);--> statement-breakpoint
CREATE INDEX `saved_items_user_idx` ON `savedItems` (`userId`);