"use server";

import { revalidatePath } from "next/cache";

import { failure } from "@/lib/action-result";
import type { FormState } from "@/schemas/forms";
import {
  signResourceUpload,
  signSubmissionUpload,
  type UploadMeta,
} from "@/services/file";
import { saveUploadedResource } from "@/services/operations";

/**
 * Unggahan berjalan dua langkah: server menandatangani satu kunci objek, lalu
 * peramban mengirim berkasnya langsung ke penyimpanan.
 *
 * Bytes-nya tidak melewati fungsi server sama sekali. Berkas 25 MB akan
 * menabrak batas ukuran badan permintaan pada platform, dan menyalin berkas
 * yang sama dua kali hanya menambah waktu tunggu serta satu titik gagal baru.
 * Yang diperiksa server adalah wewenang pengunggah dan batas ukurannya —
 * sebelum menandatangani, dan sekali lagi terhadap objek yang benar-benar
 * tersimpan sebelum barisnya dibuat.
 */
export type SignedUploadState = FormState & {
  upload?: { key: string; url: string };
};

export async function signResourceUploadAction(
  batchId: string,
  meta: UploadMeta,
): Promise<SignedUploadState> {
  try {
    return { upload: await signResourceUpload(batchId, meta) };
  } catch (error) {
    return failure(error);
  }
}

export async function signSubmissionUploadAction(
  batchId: string,
  assignmentId: string,
  meta: UploadMeta,
): Promise<SignedUploadState> {
  try {
    return { upload: await signSubmissionUpload(batchId, assignmentId, meta) };
  } catch (error) {
    return failure(error);
  }
}

export async function uploadedResourceAction(
  batchId: string,
  input: { title: string; description: string; storageKey: string },
): Promise<FormState> {
  try {
    await saveUploadedResource(batchId, input);
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Berkas materi diunggah." };
  } catch (error) {
    return failure(error);
  }
}
