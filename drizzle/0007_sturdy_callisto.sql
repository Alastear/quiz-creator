CREATE TYPE "public"."txn_kind" AS ENUM('credit_pack', 'donation', 'pro');--> statement-breakpoint
CREATE TYPE "public"."txn_status" AS ENUM('pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "txn_kind" NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'thb' NOT NULL,
	"credits_granted" integer DEFAULT 0 NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"provider_ref" text,
	"status" "txn_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;