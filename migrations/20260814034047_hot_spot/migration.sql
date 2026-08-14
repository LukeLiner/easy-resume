CREATE TABLE "payment_exception_log" (
	"id" text PRIMARY KEY,
	"order_no" text,
	"user_id" text,
	"stage" text NOT NULL,
	"error_type" text NOT NULL,
	"message" text,
	"raw_payload" text,
	"stack" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_order" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"order_no" text NOT NULL UNIQUE,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"code_url" text,
	"transaction_id" text,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payment_exception_log_order_no_index" ON "payment_exception_log" ("order_no");--> statement-breakpoint
CREATE INDEX "payment_exception_log_user_id_created_at_index" ON "payment_exception_log" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_exception_log_error_type_index" ON "payment_exception_log" ("error_type");--> statement-breakpoint
CREATE INDEX "payment_order_user_id_created_at_index" ON "payment_order" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_order_status_index" ON "payment_order" ("status");--> statement-breakpoint
ALTER TABLE "payment_exception_log" ADD CONSTRAINT "payment_exception_log_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payment_order" ADD CONSTRAINT "payment_order_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;