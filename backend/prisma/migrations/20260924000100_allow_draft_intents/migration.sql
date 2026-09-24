-- AlterTable
ALTER TABLE "intents" ALTER COLUMN "published_at" DROP NOT NULL,
ALTER COLUMN "published_at" DROP DEFAULT;
