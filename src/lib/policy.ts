import type { Prisma, UserRole } from "@prisma/client";
export type Actor = { id: string; role: UserRole; organizationIds: string[] };
export function isAdmin(role: UserRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}
export function home(role: UserRole) {
  return isAdmin(role)
    ? "/admin"
    : role === "TRAINER"
      ? "/trainer"
      : role === "CORPORATE_PIC"
        ? "/organization"
        : "/dashboard";
}
export function batchScope(actor: Actor): Prisma.TrainingBatchWhereInput {
  const base = { deletedAt: null };
  if (isAdmin(actor.role)) return base;
  if (actor.role === "TRAINER")
    return { ...base, trainers: { some: { trainerId: actor.id } } };
  if (actor.role === "CORPORATE_PIC")
    return { ...base, organizationId: { in: actor.organizationIds } };
  return {
    ...base,
    enrollments: {
      some: {
        participantId: actor.id,
        deletedAt: null,
        status: { not: "CANCELLED" },
      },
    },
  };
}
export function canAssignRole(actorRole: UserRole, targetRole: UserRole) {
  return (
    actorRole === "SUPER_ADMIN" ||
    (actorRole === "ADMIN" && !["ADMIN", "SUPER_ADMIN"].includes(targetRole))
  );
}
