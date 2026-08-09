CREATE TABLE "user_quota" (
	"user_id" text PRIMARY KEY,
	"thread_messages_limit" integer DEFAULT -1 NOT NULL,
	"resume_analyses_limit" integer DEFAULT -1 NOT NULL,
	"resume_downloads_limit" integer DEFAULT -1 NOT NULL,
	"thread_messages_used" integer DEFAULT 0 NOT NULL,
	"resume_analyses_used" integer DEFAULT 0 NOT NULL,
	"resume_downloads_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "application";--> statement-breakpoint
ALTER TABLE "ai_providers" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "user_quota_user_id_index" ON "user_quota" ("user_id");--> statement-breakpoint
ALTER TABLE "user_quota" ADD CONSTRAINT "user_quota_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;