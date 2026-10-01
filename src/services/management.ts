import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "./access";
import { notify } from "./notification";
import { dateRange } from "@/lib/utils";
import { canAssignRole } from "@/lib/policy";
import { courseCopyData } from "@/lib/course-copy";
import {
  organizationSchema,
  userSchema,
  courseSchema,
  batchSchema,
  lessonSchema,
} from "@/schemas/forms";
import { z } from "zod";
export type Entity =
  | "organization"
  | "user"
  | "course"
  | "batch"
  | "module"
  | "lesson"
  | "enrollment"
  | "trainer";
export async function saveEntity(
  entity: Entity,
  id: string | undefined,
  parentId: string | undefined,
  input: Record<string, unknown>,
) {
  const actor = await requireAdmin();
  return db.$transaction(
    async (tx) => {
      let entityId = id ?? "";
      if (entity === "organization") {
        const data = organizationSchema.parse(input);
        if (id)
          await tx.organization.findFirstOrThrow({
            where: { id, deletedAt: null },
          });
        const record = id
          ? await tx.organization.update({
              where: { id },
              data: { ...data, updatedBy: actor.id },
            })
          : await tx.organization.create({
              data: { ...data, createdBy: actor.id },
            });
        entityId = record.id;
      } else if (entity === "user") {
        const data = userSchema.parse(input);
        const existing = id
          ? await tx.user.findFirstOrThrow({ where: { id, deletedAt: null } })
          : null;
        if (
          !canAssignRole(actor.role, data.role) ||
          (existing && !canAssignRole(actor.role, existing.role))
        )
          throw new Error(
            "Hanya Super Admin dapat mengelola akun administrator.",
          );
        if (id === actor.id)
          throw new Error(
            "Gunakan halaman profil untuk mengubah akun Anda sendiri.",
          );
        const { organizationId, authId, ...fields } = data;
        if (organizationId)
          await tx.organization.findFirstOrThrow({
            where: { id: organizationId, deletedAt: null },
          });
        if (authId && existing?.isDemo)
          throw new Error("Akun demo tidak dapat ditautkan ke akun produksi.");
        const record = id
          ? await tx.user.update({
              where: { id },
              data: { ...fields, authId: authId || null, updatedBy: actor.id },
            })
          : await tx.user.create({
              data: { ...fields, authId: authId || null, createdBy: actor.id },
            });
        entityId = record.id;
        if (
          existing &&
          !organizationId &&
          (await tx.enrollment.count({
            where: {
              participantId: existing.id,
              deletedAt: null,
              batch: { organizationId: { not: null } },
            },
          })) > 0
        )
          throw new Error(
            "Pengguna dengan riwayat training perusahaan harus tetap memiliki organisasi.",
          );
        if (existing && organizationId) {
          const foreign = await tx.enrollment.count({
            where: {
              participantId: existing.id,
              deletedAt: null,
              batch: { organizationId: { not: organizationId } },
            },
          });
          if (foreign)
            throw new Error(
              "Organisasi tidak dapat dipindah ketika masih ada riwayat training organisasi lain.",
            );
        }
        await tx.organizationMember.deleteMany({
          where: { userId: record.id },
        });
        if (organizationId)
          await tx.organizationMember.create({
            data: {
              userId: record.id,
              organizationId,
              isPic: data.role === "CORPORATE_PIC",
            },
          });
      } else if (entity === "course") {
        const existing = id
          ? await tx.course.findFirstOrThrow({ where: { id, deletedAt: null } })
          : null;
        const data = courseSchema.parse(existing?.sourceCourseId
          ? { ...input, published: String(existing.published) }
          : input);
        const slug =
          data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") +
          "-" +
          crypto.randomUUID().slice(0, 6);
        const record = id
          ? await tx.course.update({
              where: { id },
              data: { ...data, updatedBy: actor.id },
            })
          : await tx.course.create({
              data: { ...data, slug, createdBy: actor.id },
            });
        entityId = record.id;
      } else if (entity === "batch") {
        const { trainerId, ...data } = batchSchema.parse(input);
        const old = id ? await tx.trainingBatch.findFirstOrThrow({
          where: { id, deletedAt: null },
          include: { _count: { select: { enrollments: true, assessments: true } } },
        }) : null;
        if (data.organizationId)
          await tx.organization.findFirstOrThrow({
            where: { id: data.organizationId, deletedAt: null },
          });
        if (trainerId)
          await tx.user.findFirstOrThrow({
            where: {
              id: trainerId,
              role: "TRAINER",
              active: true,
              deletedAt: null,
            },
          });
        if (old) {
          if (
            old._count.enrollments &&
            (old.courseId !== data.courseId ||
              old.organizationId !== (data.organizationId || null))
          )
            throw new Error(
              "Course dan organisasi tidak dapat diganti setelah peserta terdaftar.",
            );
          if (old.courseId !== data.courseId && old._count.assessments)
            throw new Error("Course tidak dapat diganti setelah penilaian dibuat. Edit salinan course pada training ini.");
          const count = await tx.enrollment.count({
            where: {
              batchId: id,
              deletedAt: null,
              status: { not: "CANCELLED" },
            },
          });
          if (data.capacity < count)
            throw new Error(
              "Kapasitas lebih kecil dari jumlah peserta terdaftar.",
            );
          if (data.status === "COMPLETED")
            throw new Error(
              "Penutupan training menunggu pemeriksaan kelulusan pada fase berikutnya.",
            );
        }
        if (data.status === "COMPLETED")
          throw new Error(
            "Training baru tidak dapat langsung berstatus selesai.",
          );
        const values = {
          ...data,
          organizationId: data.organizationId || null,
          startDate: new Date(data.startDate + "T00:00:00+07:00"),
          endDate: new Date(data.endDate + "T23:59:59+07:00"),
        };
        if (!old || old.courseId !== data.courseId) {
          const source = await tx.course.findFirstOrThrow({
            where: { id: data.courseId, sourceCourseId: null, deletedAt: null },
            include: {
              modules: { include: { lessons: true } },
              questions: { include: { options: true } },
            },
          });
          const copy = await tx.course.create({ data: courseCopyData(source, actor.id) });
          values.courseId = copy.id;
          if (old) await tx.course.update({
            where: { id: old.courseId },
            data: { deletedAt: new Date(), updatedBy: actor.id },
          });
        }
        const record = id
          ? await tx.trainingBatch.update({
              where: { id },
              data: { ...values, updatedBy: actor.id },
            })
          : await tx.trainingBatch.create({
              data: {
                ...values,
                code: `TQI-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
                createdBy: actor.id,
              },
            });
        entityId = record.id;
        if (trainerId)
          await tx.trainingBatchTrainer.upsert({
            where: { batchId_trainerId: { batchId: record.id, trainerId } },
            create: { batchId: record.id, trainerId },
            update: {},
          });
      } else if (entity === "module") {
        const { title } = z
          .object({ title: z.string().trim().min(2).max(200) })
          .parse(input);
        await tx.course.findFirstOrThrow({
          where: { id: parentId, deletedAt: null },
        });
        if (id) {
          await tx.courseModule.findFirstOrThrow({
            where: { id, courseId: parentId },
          });
          await tx.courseModule.update({ where: { id }, data: { title } });
        } else {
          const max = await tx.courseModule.aggregate({
            where: { courseId: parentId },
            _max: { position: true },
          });
          const record = await tx.courseModule.create({
            data: {
              title,
              courseId: parentId!,
              position: (max._max.position ?? 0) + 1,
            },
          });
          entityId = record.id;
        }
      } else if (entity === "lesson") {
        const data = lessonSchema.parse(input);
        await tx.courseModule.findFirstOrThrow({
          where: { id: parentId, course: { deletedAt: null } },
        });
        if (id) {
          await tx.lesson.findFirstOrThrow({
            where: { id, moduleId: parentId },
          });
          await tx.lesson.update({ where: { id }, data });
        } else {
          const max = await tx.lesson.aggregate({
            where: { moduleId: parentId },
            _max: { position: true },
          });
          const record = await tx.lesson.create({
            data: {
              ...data,
              moduleId: parentId!,
              position: (max._max.position ?? 0) + 1,
            },
          });
          entityId = record.id;
        }
      } else if (entity === "enrollment") {
        const { participantId } = z
          .object({ participantId: z.string().min(1) })
          .parse(input);
        const batch = await tx.trainingBatch.findFirstOrThrow({
          where: { id: parentId, deletedAt: null },
        });
        if (!["OPEN", "ONGOING"].includes(batch.status))
          throw new Error(
            "Pendaftaran hanya tersedia untuk training terbuka atau berlangsung.",
          );
        const participant = await tx.user.findFirstOrThrow({
          where: {
            id: participantId,
            role: "PARTICIPANT",
            active: true,
            deletedAt: null,
          },
          include: { memberships: true },
        });
        if (
          batch.organizationId &&
          !participant.memberships.some(
            (m) => m.organizationId === batch.organizationId,
          )
        )
          throw new Error("Peserta harus berasal dari organisasi training.");
        const count = await tx.enrollment.count({
          where: {
            batchId: batch.id,
            deletedAt: null,
            status: { not: "CANCELLED" },
          },
        });
        if (count >= batch.capacity)
          throw new Error("Kapasitas training sudah penuh.");
        const record = await tx.enrollment.upsert({
          where: {
            batchId_participantId: { batchId: batch.id, participantId },
          },
          create: { batchId: batch.id, participantId, createdBy: actor.id },
          update: { status: "ENROLLED", deletedAt: null, updatedBy: actor.id },
        });
        entityId = record.id;
        // Didaftarkan orang lain, jadi kelas ini muncul begitu saja pada
        // halaman peserta. Surel menyertainya karena jadwalnya perlu masuk
        // agenda sebelum hari pertama.
        await notify(
          participantId,
          {
            title: "Anda terdaftar pada training baru",
            message: `${batch.title} — ${dateRange(batch.startDate, batch.endDate)}.`,
            href: `/my-training/${batch.id}`,
            email: true,
          },
          tx,
        );
      } else if (entity === "trainer") {
        const { trainerId } = z
          .object({ trainerId: z.string().min(1) })
          .parse(input);
        await tx.trainingBatch.findFirstOrThrow({
          where: { id: parentId, deletedAt: null },
        });
        await tx.user.findFirstOrThrow({
          where: {
            id: trainerId,
            role: "TRAINER",
            active: true,
            deletedAt: null,
          },
        });
        const record = await tx.trainingBatchTrainer.upsert({
          where: { batchId_trainerId: { batchId: parentId!, trainerId } },
          create: { batchId: parentId!, trainerId },
          update: {},
        });
        entityId = record.id;
      } else throw new Error("Jenis data tidak dikenal.");
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: id ? "UPDATE" : "CREATE",
          entity,
          entityId,
        },
      });
      return entityId;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    },
  );
}
export async function archiveEntity(entity: Entity, id: string) {
  const actor = await requireAdmin();
  await db.$transaction(async (tx) => {
    if (entity === "organization") {
      if (
        await tx.trainingBatch.count({
          where: {
            organizationId: id,
            deletedAt: null,
            status: { in: ["OPEN", "ONGOING"] },
          },
        })
      )
        throw new Error("Organisasi masih memiliki training aktif.");
      await tx.organization.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: actor.id },
      });
    } else if (entity === "user") {
      const user = await tx.user.findUniqueOrThrow({ where: { id } });
      if (id === actor.id || !canAssignRole(actor.role, user.role))
        throw new Error("Akun ini tidak dapat dinonaktifkan oleh Anda.");
      await tx.user.update({
        where: { id },
        data: { active: false, updatedBy: actor.id },
      });
    } else if (entity === "course") {
      if (
        await tx.trainingBatch.count({
          where: {
            courseId: id,
            deletedAt: null,
            status: { in: ["OPEN", "ONGOING"] },
          },
        })
      )
        throw new Error("Course masih dipakai training aktif.");
      await tx.course.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: actor.id },
      });
    } else if (entity === "enrollment") {
      await tx.enrollment.update({
        where: { id },
        data: {
          status: "CANCELLED",
          deletedAt: new Date(),
          updatedBy: actor.id,
        },
      });
    } else if (entity === "batch") {
      const batch = await tx.trainingBatch.findFirstOrThrow({
        where: { id, deletedAt: null },
      });
      if (["OPEN", "ONGOING"].includes(batch.status))
        throw new Error(
          "Training aktif harus ditutup atau dibatalkan sebelum diarsipkan.",
        );
      await tx.trainingBatch.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: actor.id },
      });
    } else throw new Error("Arsip tidak tersedia untuk data ini.");
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "ARCHIVE", entity, entityId: id },
    });
  });
}

/**
 * Menghapus permanen entitas course atau batch beserta seluruh data
 * turunannya. Hanya entitas yang belum diarsipkan (deletedAt === null)
 * yang ditangani di sini — penghapusan dari arsip memakai deleteArchived.
 *
 * Operasi ini tidak dapat dibatalkan. Pemeriksaan keselamatan:
 * - Course: tidak boleh masih dipakai oleh training manapun (aktif/non-aktif).
 * - Batch:  tidak boleh memiliki peserta, penilaian, atau tugas.
 */
export async function deleteEntity(
  entity: "course" | "batch",
  id: string,
) {
  const actor = await requireAdmin();
  await db.$transaction(
    async (tx) => {
      if (entity === "course") {
        const course = await tx.course.findFirstOrThrow({
          where: { id, sourceCourseId: null, deletedAt: null },
        });

        // Tolak jika course induk ini masih memiliki salinan yang dipakai
        // training mana pun (termasuk training yang sudah diarsipkan).
        const copyCount = await tx.course.count({
          where: { sourceCourseId: course.id, batches: { some: {} } },
        });
        if (copyCount > 0)
          throw new Error(
            "Course ini masih dipakai oleh training. Hapus training terkait terlebih dahulu.",
          );

        // Hapus bank soal beserta opsinya
        await tx.questionOption.deleteMany({
          where: { question: { courseId: course.id } },
        });
        await tx.assessmentQuestion.deleteMany({
          where: { question: { courseId: course.id } },
        });
        await tx.question.deleteMany({ where: { courseId: course.id } });

        // Hapus kurikulum
        await tx.lesson.deleteMany({
          where: { module: { courseId: course.id } },
        });
        await tx.courseModule.deleteMany({ where: { courseId: course.id } });

        // Hapus course itu sendiri
        await tx.course.delete({ where: { id } });
      } else if (entity === "batch") {
        const batch = await tx.trainingBatch.findFirstOrThrow({
          where: { id, deletedAt: null },
        });

        if (["OPEN", "ONGOING"].includes(batch.status))
          throw new Error(
            "Training aktif tidak dapat dihapus. Ubah statusnya terlebih dahulu.",
          );

        // Tolak jika training memiliki data operasional
        const enrollCount = await tx.enrollment.count({
          where: { batchId: id },
        });
        if (enrollCount > 0)
          throw new Error(
            "Training ini memiliki data peserta dan tidak dapat dihapus. Gunakan arsip sebagai gantinya.",
          );

        const assessmentCount = await tx.assessment.count({
          where: { batchId: id },
        });
        if (assessmentCount > 0)
          throw new Error(
            "Training ini memiliki penilaian dan tidak dapat dihapus. Gunakan arsip sebagai gantinya.",
          );

        const assignmentCount = await tx.assignment.count({
          where: { batchId: id },
        });
        if (assignmentCount > 0)
          throw new Error(
            "Training ini memiliki tugas dan tidak dapat dihapus. Gunakan arsip sebagai gantinya.",
          );

        // Hapus trainer assignment
        await tx.trainingBatchTrainer.deleteMany({ where: { batchId: id } });

        // Hapus resource
        await tx.trainingResource.deleteMany({ where: { batchId: id } });

        // Hapus evaluasi training (formulir dan respons)
        const evaluation = await tx.trainingEvaluation.findUnique({
          where: { batchId: id },
        });
        if (evaluation) {
          await tx.evaluationResponse.deleteMany({
            where: { evaluationId: evaluation.id },
          });
          await tx.trainingEvaluation.delete({ where: { id: evaluation.id } });
        }

        // Hapus salinan course khusus training ini
        const courseId = batch.courseId;
        await tx.trainingBatch.delete({ where: { id } });

        // Hapus course copy (salinan khusus training)
        const copy = await tx.course.findFirst({
          where: { id: courseId, sourceCourseId: { not: null } },
        });
        if (copy) {
          await tx.questionOption.deleteMany({
            where: { question: { courseId: copy.id } },
          });
          await tx.assessmentQuestion.deleteMany({
            where: { question: { courseId: copy.id } },
          });
          await tx.question.deleteMany({ where: { courseId: copy.id } });
          await tx.lesson.deleteMany({
            where: { module: { courseId: copy.id } },
          });
          await tx.courseModule.deleteMany({ where: { courseId: copy.id } });
          await tx.course.delete({ where: { id: copy.id } });
        }
      } else {
        throw new Error("Penghapusan permanen tidak tersedia untuk data ini.");
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "DELETE",
          entity,
          entityId: id,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30000,
    },
  );
}
export async function reorder(
  entity: "module" | "lesson",
  id: string,
  direction: number,
) {
  const actor = await requireAdmin();
  if (direction !== -1 && direction !== 1) throw new Error("Arah tidak valid.");
  await db.$transaction(
    async (tx) => {
      if (entity === "module") {
        const item = await tx.courseModule.findUniqueOrThrow({ where: { id } });
        const neighbor = await tx.courseModule.findFirst({
          where: {
            courseId: item.courseId,
            position: item.position + direction,
          },
        });
        if (!neighbor) return;
        await tx.courseModule.update({ where: { id }, data: { position: -1 } });
        await tx.courseModule.update({
          where: { id: neighbor.id },
          data: { position: item.position },
        });
        await tx.courseModule.update({
          where: { id },
          data: { position: neighbor.position },
        });
      } else {
        const item = await tx.lesson.findUniqueOrThrow({ where: { id } });
        const neighbor = await tx.lesson.findFirst({
          where: {
            moduleId: item.moduleId,
            position: item.position + direction,
          },
        });
        if (!neighbor) return;
        await tx.lesson.update({ where: { id }, data: { position: -1 } });
        await tx.lesson.update({
          where: { id: neighbor.id },
          data: { position: item.position },
        });
        await tx.lesson.update({
          where: { id },
          data: { position: neighbor.position },
        });
      }
      await tx.auditLog.create({
        data: { actorId: actor.id, action: "REORDER", entity, entityId: id },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
