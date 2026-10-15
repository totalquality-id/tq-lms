-- Susulan: studi kasus (3483f61) ditambahkan ke skema tanpa migrasi. Ditulis
-- idempoten supaya aman di basis data yang sudah menerimanya lewat db push,
-- dan tetap membuat basis data baru setara dengan skema.
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'CASE_STUDY';

BEGIN;

ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "requiresReason" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Question_parentId_fkey' AND conrelid = '"Question"'::regclass) THEN
    ALTER TABLE "Question" ADD CONSTRAINT "Question_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Urutan soal, tautan salinan ke soal induknya, dan penanda salinan terlepas.
ALTER TABLE "Question" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Question" ADD COLUMN "sourceQuestionId" TEXT;
ALTER TABLE "Question" ADD COLUMN "detached" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Question_courseId_parentId_position_idx" ON "Question"("courseId", "parentId", "position");
CREATE INDEX "Question_sourceQuestionId_idx" ON "Question"("sourceQuestionId");

-- Urutan awal = urutan yang selama ini tampil di bank soal (topik, lalu id),
-- dihitung per kelompok soal sesaudara.
UPDATE "Question" q SET "position" = ranked.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "courseId", "parentId" ORDER BY "topic", "id") AS rn
  FROM "Question"
) ranked
WHERE ranked."id" = q."id";

-- Salinan training dikenali dari format id-nya: <copyId>_<idInduk>, atau format
-- migrasi lama tq_<batchId>_<idInduk> untuk salinan tc_<batchId>.
UPDATE "Question" cq SET "sourceQuestionId" = sq."id"
FROM "Course" c, "Question" sq
WHERE cq."courseId" = c."id"
  AND c."sourceCourseId" IS NOT NULL
  AND sq."courseId" = c."sourceCourseId"
  AND (
    cq."id" = c."id" || '_' || sq."id"
    OR cq."id" = 'tq_' || substr(c."id", 4) || '_' || sq."id"
  );

-- Salinan mengikuti urutan induk.
UPDATE "Question" cq SET "position" = sq."position"
FROM "Question" sq
WHERE cq."sourceQuestionId" = sq."id";

-- Salinan yang pernah disunting atau diarsipkan langsung di training (tercatat
-- di audit log atas id salinan itu sendiri) dipertahankan apa adanya.
UPDATE "Question" cq SET "detached" = true
WHERE cq."sourceQuestionId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "AuditLog" al
    WHERE al."entity" = 'question'
      AND al."entityId" = cq."id"
      AND al."action" IN ('UPDATE', 'ARCHIVE')
  );

COMMIT;
