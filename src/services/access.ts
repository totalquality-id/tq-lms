import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

import { auth, demoEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchScope, home, isAdmin } from "@/lib/policy";

export const currentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findFirst({
    where: { id: session.user.id, active: true, deletedAt: null },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user || (user.isDemo && !demoEnabled())) redirect("/login");
  return {
    ...user,
    organizationIds: user.memberships
      .filter((member) => member.isPic && !member.organization.deletedAt)
      .map((member) => member.organizationId),
  };
});

export async function requireRole(...roles: UserRole[]) {
  const user = await currentUser();
  if (!roles.includes(user.role)) redirect(home(user.role));
  return user;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!isAdmin(user.role))
    throw new Error("Anda tidak memiliki akses administrator.");
  return user;
}

/**
 * Wewenang mengelola satu training: administrator, atau trainer yang memang
 * ditugaskan pada kelas itu. Diperiksa dengan query, bukan dengan menyaring
 * hasil di memori, sehingga id yang ditebak tetap berakhir di 404.
 */
export async function requireBatchStaff(batchId: string) {
  const user = await currentUser();
  const batch = await db.trainingBatch.findFirst({
    where: {
      id: batchId,
      deletedAt: null,
      ...(isAdmin(user.role)
        ? {}
        : { trainers: { some: { trainerId: user.id } } }),
    },
  });
  if (!batch) notFound();
  return { user, batch, admin: isAdmin(user.role) };
}

export async function accessibleBatch(id: string) {
  const user = await currentUser();
  const batch = await db.trainingBatch.findFirst({
    where: { AND: [{ id }, batchScope(user)] },
    include: {
      course: {
        include: {
          modules: {
            orderBy: { position: "asc" },
            include: { lessons: { orderBy: { position: "asc" } } },
          },
        },
      },
      organization: true,
      trainers: { include: { trainer: true } },
      assessments: { where: { deletedAt: null }, orderBy: { type: "asc" } },
      assignments: { where: { deletedAt: null }, orderBy: { dueAt: "asc" } },
      resources: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      evaluation: { include: { _count: { select: { responses: true } } } },
      enrollments: {
        where: {
          deletedAt: null,
          ...(user.role === "PARTICIPANT" ? { participantId: user.id } : {}),
        },
        include: {
          participant: true,
          certificate: true,
          attendance: true,
          attempts: true,
          submissions: true,
          lessons: true,
          evaluations: true,
        },
        orderBy: { participant: { name: "asc" } },
      },
    },
  });
  if (!batch) notFound();
  return { user, batch, admin: isAdmin(user.role) };
}

export type AccessibleBatch = Awaited<
  ReturnType<typeof accessibleBatch>
>["batch"];
