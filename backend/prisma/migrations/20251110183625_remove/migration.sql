-- DropForeignKey
ALTER TABLE "conversions" DROP CONSTRAINT "conversions_userId_fkey";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
