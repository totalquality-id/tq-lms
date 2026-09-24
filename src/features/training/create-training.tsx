import { requireAdmin } from "@/services/access";
import { db } from "@/lib/db";
import { EntityForm } from "@/features/management/entity-form";
import { batchFields } from "@/features/management/fields";
export async function CreateTraining() {
  await requireAdmin();
  const [courses, orgs, trainers] = await Promise.all([
    db.course.findMany({
      where: { deletedAt: null, sourceCourseId: null },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    db.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: "TRAINER", active: true, deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);
  return (
    <EntityForm
      entity="batch"
      title="Buat training"
      fields={batchFields(courses, orgs, trainers)}
    />
  );
}
