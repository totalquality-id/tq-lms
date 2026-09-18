import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import { batchScope, isAdmin } from "@/lib/policy";
import {
  RESOURCE_MAX_BYTES,
  UPLOAD_TYPES,
  fileNameOf,
  storageKey,
  uploadError,
} from "@/lib/upload";
import {
  objectInfo,
  removeObject,
  signDownload,
  signUpload,
  storageConfigured,
} from "@/lib/supabase-storage";
import { currentUser, requireBatchStaff } from "./access";
import { myEnrollment } from "./learning";

export { storageConfigured };

const metaSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.coerce.number().int().min(1),
});

export type UploadMeta = z.input<typeof metaSchema>;

function guard(
  name: string,
  size: number,
  maxBytes: number,
  allowed?: string[],
) {
  const message = uploadError(
    name,
    size,
    maxBytes,
    allowed?.length ? allowed : undefined,
  );
  if (message) throw new Error(message);
}

/* -------------------------------------------------------------------------
   Menandatangani unggahan
   ------------------------------------------------------------------------- */

/** Tautan unggah materi pendukung, untuk trainer kelas ini dan administrator. */
export async function signResourceUpload(batchId: string, input: UploadMeta) {
  await requireBatchStaff(batchId);
  const meta = metaSchema.parse(input);
  guard(meta.name, meta.size, RESOURCE_MAX_BYTES);
  return signUpload(
    storageKey(["batch", batchId, "resource"], randomUUID(), meta.name),
  );
}

/**
 * Tautan unggah berkas tugas, untuk peserta kelas ini sendiri.
 *
 * Kunci objek mengandung id pendaftaran, bukan hanya id tugas: dua peserta
 * yang mengunggah "tugas-akhir.pdf" tidak boleh menulis ke objek yang sama.
 */
export async function signSubmissionUpload(
  batchId: string,
  assignmentId: string,
  input: UploadMeta,
) {
  const enrollment = await myEnrollment(batchId);
  const assignment = enrollment.batch.assignments.find(
    (item) => item.id === assignmentId,
  );
  if (!assignment) throw new Error("Tugas tidak tersedia pada training ini.");
  if (enrollment.batch.status === "COMPLETED")
    throw new Error("Training sudah ditutup.");

  const meta = metaSchema.parse(input);
  guard(meta.name, meta.size, assignment.maxBytes, assignment.allowedTypes);
  return signUpload(
    storageKey(
      ["batch", batchId, "assignment", assignmentId, enrollment.id],
      randomUUID(),
      meta.name,
    ),
  );
}

/* -------------------------------------------------------------------------
   Memastikan unggahan
   ------------------------------------------------------------------------- */

/**
 * Memastikan objek benar-benar ada dan masih di bawah batas sebelum baris
 * basis datanya dibuat. Berkas yang melanggar dihapus di tempat: membiarkannya
 * berarti menyimpan sesuatu yang tidak pernah dirujuk siapa pun, dan kuota
 * penyimpanan tetap terpakai.
 */
export async function confirmUpload(
  key: string,
  maxBytes: number,
  prefix: string,
) {
  if (!key.startsWith(prefix))
    throw new Error("Berkas tidak dikenali untuk unggahan ini.");

  const info = await objectInfo(key);
  if (!info)
    throw new Error(
      "Berkas belum selesai diunggah. Coba unggah ulang lalu simpan kembali.",
    );
  if (info.size > maxBytes) {
    await removeObject(key);
    throw new Error(
      uploadError(fileNameOf(key), info.size, maxBytes) ??
        "Ukuran berkas melebihi batas.",
    );
  }
  return info;
}

/* -------------------------------------------------------------------------
   Tautan unduhan
   ------------------------------------------------------------------------- */

/**
 * Tautan unduh materi: siapa pun yang berhak membuka training ini. Wewenangnya
 * diperiksa lewat klausa query yang sama dengan halaman training, sehingga id
 * materi yang ditebak tetap berakhir tanpa tautan.
 */
export async function resourceDownload(id: string) {
  const user = await currentUser();
  const resource = await db.trainingResource.findFirst({
    where: {
      id,
      deletedAt: null,
      storageKey: { not: null },
      batch: batchScope(user),
    },
  });
  if (!resource?.storageKey) return null;
  return signDownload(resource.storageKey, fileNameOf(resource.storageKey));
}

/**
 * Tautan unduh berkas tugas: pemiliknya, trainer kelas itu, dan administrator.
 * PIC perusahaan tidak termasuk — yang menjadi haknya adalah status
 * penyelesaian karyawannya, bukan isi pekerjaan yang mereka kumpulkan.
 */
export async function submissionDownload(id: string) {
  const user = await currentUser();
  const submission = await db.assignmentSubmission.findFirst({
    where: {
      id,
      storageKey: { not: null },
      assignment: { deletedAt: null, batch: { deletedAt: null } },
      ...(isAdmin(user.role)
        ? {}
        : {
            OR: [
              { enrollment: { participantId: user.id } },
              {
                assignment: {
                  batch: { trainers: { some: { trainerId: user.id } } },
                },
              },
            ],
          }),
    },
  });
  if (!submission?.storageKey) return null;
  return signDownload(submission.storageKey, fileNameOf(submission.storageKey));
}

/** Ekstensi yang diterima, untuk atribut `accept` pada pemilih berkas. */
export const ACCEPTED_EXTENSIONS = Object.keys(UPLOAD_TYPES)
  .map((extension) => `.${extension}`)
  .join(",");
