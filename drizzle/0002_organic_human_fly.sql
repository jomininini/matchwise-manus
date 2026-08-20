CREATE TABLE `companyEmbeddings` (
	`id` varchar(96) NOT NULL,
	`profileId` varchar(96) NOT NULL,
	`model` varchar(128) NOT NULL,
	`inputHash` varchar(64) NOT NULL,
	`embedding` VECTOR(1024) NOT NULL,
	`importBatchId` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companyEmbeddings_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_embeddings_profile_unique` UNIQUE(`profileId`)
);
--> statement-breakpoint
CREATE INDEX `company_embeddings_import_idx` ON `companyEmbeddings` (`importBatchId`);