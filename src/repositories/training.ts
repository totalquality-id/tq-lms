import "server-only";
import { db } from "@/lib/db";
import { batchScope, type Actor } from "@/lib/policy";
import { TrainingStatus } from "@prisma/client";
export const trainingInclude = {
  course: true,
  organization: true,
  trainers: { include: { trainer: true } },
  _count: {
    select: {
      enrollments: {
        where: { deletedAt: null, status: { not: "CANCELLED" as const } },
      },
    },
  },
};
export async function listTraining(
  actor: Actor,
  q = "",
  status = "",
  page = 1,
  size = 10,
) {
  const where = {
    AND: [
      batchScope(actor),
      {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { code: { contains: q, mode: "insensitive" as const } },
          {
            organization: {
              name: { contains: q, mode: "insensitive" as const },
            },
          },
        ],
      },
    ],
    ...(Object.values(TrainingStatus).includes(status as TrainingStatus)
      ? { status: status as TrainingStatus }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.trainingBatch.findMany({
      where,
      include: trainingInclude,
      orderBy: { startDate: "desc" },
      skip: (page - 1) * size,
      take: size,
    }),
    db.trainingBatch.count({ where }),
  ]);
  return { items, total };
}
