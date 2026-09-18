-- CreateEnum
CREATE TYPE "SelectionMode" AS ENUM ('ALL', 'MANUAL', 'RULES');

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "selection" "SelectionMode" NOT NULL DEFAULT 'ALL';
