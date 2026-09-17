import { test } from "node:test";
import assert from "node:assert/strict";
import { batchScope, canAssignRole, home } from "../src/lib/policy";
import { batchSchema, lessonSchema, userSchema } from "../src/schemas/forms";
test("participant query must be scoped to active own enrollments", () => {
  assert.deepEqual(
    batchScope({ id: "p1", role: "PARTICIPANT", organizationIds: [] }),
    {
      deletedAt: null,
      enrollments: {
        some: {
          participantId: "p1",
          deletedAt: null,
          status: { not: "CANCELLED" },
        },
      },
    },
  );
});
test("trainer query is restricted to explicit assignments", () => {
  assert.deepEqual(
    batchScope({ id: "t1", role: "TRAINER", organizationIds: [] }),
    { deletedAt: null, trainers: { some: { trainerId: "t1" } } },
  );
});
test("PIC without memberships matches no organizations", () => {
  assert.deepEqual(
    batchScope({ id: "c1", role: "CORPORATE_PIC", organizationIds: [] }),
    { deletedAt: null, organizationId: { in: [] } },
  );
});
test("administrator cannot promote another administrator", () => {
  assert.equal(canAssignRole("ADMIN", "SUPER_ADMIN"), false);
  assert.equal(canAssignRole("ADMIN", "ADMIN"), false);
  assert.equal(canAssignRole("PARTICIPANT", "TRAINER"), false);
  assert.equal(canAssignRole("SUPER_ADMIN", "ADMIN"), true);
});
test("each role routes to its workspace", () => {
  assert.equal(home("PARTICIPANT"), "/dashboard");
  assert.equal(home("TRAINER"), "/trainer");
  assert.equal(home("CORPORATE_PIC"), "/organization");
  assert.equal(home("ADMIN"), "/admin");
});
const batch = {
  title: "Security training",
  courseId: "course-1",
  organizationId: "org-1",
  mode: "OFFLINE",
  status: "OPEN",
  startDate: "2026-09-20",
  endDate: "2026-09-21",
  startTime: "09:00",
  endTime: "16:00",
  capacity: 20,
};
test("training dates, capacity and online location are validated", () => {
  assert.equal(batchSchema.safeParse(batch).success, true);
  assert.equal(
    batchSchema.safeParse({ ...batch, endDate: "2026-09-01" }).success,
    false,
  );
  assert.equal(batchSchema.safeParse({ ...batch, capacity: 0 }).success, false);
  assert.equal(
    batchSchema.safeParse({ ...batch, mode: "ONLINE" }).success,
    false,
  );
  assert.equal(
    batchSchema.safeParse({ ...batch, startTime: "99:00" }).success,
    false,
  );
});
test("lesson rejects unsafe URL schemes and empty articles", () => {
  assert.equal(
    lessonSchema.safeParse({
      title: "Sample lesson",
      type: "TEXT",
      content: "",
      duration: 15,
    }).success,
    false,
  );
  assert.equal(
    lessonSchema.safeParse({
      title: "Sample lesson",
      type: "EXTERNAL_LINK",
      resourceUrl: "javascript:alert(1)",
      duration: 15,
    }).success,
    false,
  );
});
test("PIC must have an organization", () => {
  assert.equal(
    userSchema.safeParse({
      name: "Corporate PIC",
      email: "pic@example.test",
      role: "CORPORATE_PIC",
    }).success,
    false,
  );
});
