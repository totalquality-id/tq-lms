import { Prisma } from "@prisma/client";
import { z } from "zod";

import type { FormState } from "@/schemas/forms";

/**
 * Menerjemahkan kegagalan menjadi kalimat yang dapat ditindaklanjuti pembaca.
 * Galat basis data tidak pernah diteruskan apa adanya: pesannya membocorkan
 * nama tabel dan kolom tanpa membantu siapa pun memperbaiki isiannya.
 */
export function failure(error: unknown): FormState {
  if (error instanceof z.ZodError)
    return {
      error: "Periksa kembali informasi yang Anda isi.",
      fields: z.flattenError(error).fieldErrors,
    };

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return { error: "Data dengan identitas tersebut sudah terdaftar." };
    if (error.code === "P2034")
      return {
        error: "Data baru saja diperbarui pengguna lain. Silakan coba kembali.",
      };
    if (error.code === "P2025")
      return { error: "Data tidak ditemukan atau sudah diarsipkan." };
    return {
      error:
        "Data belum dapat disimpan. Periksa relasi data lalu coba kembali.",
    };
  }

  return {
    error:
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan. Silakan coba lagi.",
  };
}
