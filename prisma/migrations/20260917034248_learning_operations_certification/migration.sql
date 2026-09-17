/*
  Warnings:

  - Added the required column `url` to the `TrainingResource` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AssignmentSubmission" ADD COLUMN     "link" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "storageKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "code" TEXT NOT NULL DEFAULT 'TQ';

-- AlterTable
ALTER TABLE "TrainingEvaluation" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "open" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'Evaluasi pelatihan';

-- AlterTable
ALTER TABLE "TrainingResource" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "url" TEXT NOT NULL,
ALTER COLUMN "storageKey" DROP NOT NULL,
ALTER COLUMN "mimeType" SET DEFAULT 'link',
ALTER COLUMN "size" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "CertificateSequence" (
    "scope" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertificateSequence_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE INDEX "TrainingResource_batchId_deletedAt_idx" ON "TrainingResource"("batchId", "deletedAt");
