CREATE TABLE `companyDataActivities` (
	`id` varchar(96) NOT NULL,
	`profileId` varchar(96),
	`activityType` enum('edit','enrichment','vector_update','official_refresh') NOT NULL,
	`status` enum('draft','applied','completed','failed') NOT NULL DEFAULT 'draft',
	`sourceLabel` varchar(255) NOT NULL,
	`inputData` json,
	`outputData` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `companyDataActivities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `company_data_activity_profile_idx` ON `companyDataActivities` (`profileId`);--> statement-breakpoint
CREATE INDEX `company_data_activity_type_idx` ON `companyDataActivities` (`activityType`);--> statement-breakpoint
CREATE INDEX `company_data_activity_created_idx` ON `companyDataActivities` (`createdAt`);