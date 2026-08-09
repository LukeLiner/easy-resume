ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE "user" SET "status" = 'active';--> statement-breakpoint
ALTER TABLE "user_quota" ALTER COLUMN "thread_messages_limit" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "user_quota" ALTER COLUMN "resume_analyses_limit" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "user_quota" ALTER COLUMN "resume_downloads_limit" SET DEFAULT 1;