BEGIN;

ALTER TABLE "Course" ADD COLUMN "sourceCourseId" TEXT;
CREATE INDEX "Course_sourceCourseId_idx" ON "Course"("sourceCourseId");
ALTER TABLE "Course" ADD CONSTRAINT "Course_sourceCourseId_fkey"
  FOREIGN KEY ("sourceCourseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Setiap training lama mendapat salinan sendiri, termasuk training yang diarsipkan.
-- Snapshot percobaan, jawaban, dan sertifikat sengaja tidak ditulis ulang.
DO $$
DECLARE
  batch RECORD;
  copy_id TEXT;
BEGIN
  FOR batch IN SELECT "id", "courseId", "createdBy" FROM "TrainingBatch" LOOP
    copy_id := 'tc_' || batch."id";
    INSERT INTO "Course" (
      "id", "sourceCourseId", "slug", "title", "code", "shortDescription", "description",
      "objectives", "category", "thumbnail", "published", "duration", "passingGrade",
      "sequential", "createdAt", "updatedAt", "createdBy"
    )
    SELECT copy_id, "id", copy_id, "title", "code", "shortDescription", "description",
      "objectives", "category", "thumbnail", "published", "duration", "passingGrade",
      "sequential", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, batch."createdBy"
    FROM "Course" WHERE "id" = batch."courseId";

    INSERT INTO "CourseModule" ("id", "courseId", "title", "position")
    SELECT 'tm_' || batch."id" || '_' || "id", copy_id, "title", "position"
    FROM "CourseModule" WHERE "courseId" = batch."courseId";

    INSERT INTO "Lesson" (
      "id", "moduleId", "title", "type", "content", "resourceUrl", "duration", "position", "required"
    )
    SELECT 'tl_' || batch."id" || '_' || lesson."id",
      'tm_' || batch."id" || '_' || lesson."moduleId", lesson."title", lesson."type",
      lesson."content", lesson."resourceUrl", lesson."duration", lesson."position", lesson."required"
    FROM "Lesson" lesson JOIN "CourseModule" module ON module."id" = lesson."moduleId"
    WHERE module."courseId" = batch."courseId";

    INSERT INTO "Question" (
      "id", "courseId", "topic", "difficulty", "type", "text", "correctText", "explanation", "points", "deletedAt"
    )
    SELECT 'tq_' || batch."id" || '_' || question."id", copy_id, question."topic",
      question."difficulty", question."type", question."text", question."correctText",
      question."explanation", question."points", question."deletedAt"
    FROM "Question" question
    WHERE question."courseId" = batch."courseId" OR EXISTS (
      SELECT 1 FROM "AssessmentQuestion" link JOIN "Assessment" assessment ON assessment."id" = link."assessmentId"
      WHERE link."questionId" = question."id" AND assessment."batchId" = batch."id"
    );

    INSERT INTO "QuestionOption" ("id", "questionId", "text", "correct", "position")
    SELECT 'to_' || batch."id" || '_' || option."id", 'tq_' || batch."id" || '_' || option."questionId",
      option."text", option."correct", option."position"
    FROM "QuestionOption" option
    WHERE EXISTS (SELECT 1 FROM "Question" WHERE "id" = 'tq_' || batch."id" || '_' || option."questionId");

    UPDATE "LessonCompletion" completion
    SET "lessonId" = 'tl_' || batch."id" || '_' || completion."lessonId"
    FROM "Enrollment" enrollment
    WHERE enrollment."id" = completion."enrollmentId" AND enrollment."batchId" = batch."id"
      AND EXISTS (SELECT 1 FROM "Lesson" WHERE "id" = 'tl_' || batch."id" || '_' || completion."lessonId");

    UPDATE "AssessmentQuestion" link
    SET "questionId" = 'tq_' || batch."id" || '_' || link."questionId"
    FROM "Assessment" assessment
    WHERE assessment."id" = link."assessmentId" AND assessment."batchId" = batch."id";

    UPDATE "TrainingBatch" SET "courseId" = copy_id WHERE "id" = batch."id";
  END LOOP;
END $$;

COMMIT;
