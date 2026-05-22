CREATE TYPE "public"."question_kind" AS ENUM('choice', 'text', 'story');--> statement-breakpoint
CREATE TYPE "public"."quiz_category" AS ENUM('personality', 'love', 'work', 'knowledge', 'popculture', 'lifestyle', 'other');--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "kind" "question_kind" DEFAULT 'choice' NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "category" "quiz_category" DEFAULT 'other' NOT NULL;