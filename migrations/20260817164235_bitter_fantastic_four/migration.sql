CREATE TABLE "job_analysis" (
	"id" text PRIMARY KEY,
	"analysis" jsonb NOT NULL,
	"resume_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "job_analysis_resume_id_created_at_index" ON "job_analysis" ("resume_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "job_analysis" ADD CONSTRAINT "job_analysis_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE;