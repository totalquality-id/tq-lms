-- Nilai kelulusan hanya satu sumber: Assessment.passingGrade.
--
-- TrainingBatch.passingGrade tidak pernah dapat diisi dari aplikasi, tetapi bila
-- ada training yang memilikinya, nilai itulah yang selama ini menentukan syarat
-- sertifikat. Nilainya dipindahkan ke ujian akhir training tersebut lebih dulu,
-- dan status lulus percobaannya disamakan, sehingga hasil sertifikat tidak
-- berubah oleh penghapusan kolom ini.
BEGIN;

UPDATE "Assessment" a SET "passingGrade" = b."passingGrade"
FROM "TrainingBatch" b
WHERE a."batchId" = b."id"
  AND a."type" = 'FINAL_EXAM'
  AND b."passingGrade" IS NOT NULL;

UPDATE "AssessmentAttempt" t SET "passed" = t."score" >= a."passingGrade"
FROM "Assessment" a, "TrainingBatch" b
WHERE t."assessmentId" = a."id"
  AND a."batchId" = b."id"
  AND a."type" = 'FINAL_EXAM'
  AND b."passingGrade" IS NOT NULL
  AND t."score" IS NOT NULL;

ALTER TABLE "TrainingBatch" DROP COLUMN "passingGrade";

COMMIT;
