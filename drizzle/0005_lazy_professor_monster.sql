CREATE TABLE "quiz_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"stats_snapshot" jsonb DEFAULT '{"viewCount":0,"playCount":0}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL,
	"restorable_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_archives" ADD CONSTRAINT "quiz_archives_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_archives" ADD CONSTRAINT "quiz_archives_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;