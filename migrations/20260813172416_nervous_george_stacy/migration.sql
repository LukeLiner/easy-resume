CREATE TABLE "user_transaction" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "user_transaction_user_id_created_at_index" ON "user_transaction" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "user_transaction" ADD CONSTRAINT "user_transaction_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;