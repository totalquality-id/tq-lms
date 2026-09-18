"use server";

import { revalidatePath } from "next/cache";

import { failure } from "@/lib/action-result";
import type { FormState } from "@/schemas/forms";
import { markAllRead, markRead } from "@/services/notification";

/**
 * Bel muncul pada setiap halaman ruang kerja, jadi yang dimuat ulang adalah
 * seluruh tata letaknya — bukan satu rute saja.
 */
export async function markReadAction(id: string): Promise<FormState> {
  try {
    await markRead(id);
    revalidatePath("/", "layout");
    return { success: "Pemberitahuan ditandai terbaca." };
  } catch (error) {
    return failure(error);
  }
}

export async function markAllReadAction(): Promise<FormState> {
  try {
    await markAllRead();
    revalidatePath("/", "layout");
    return { success: "Semua pemberitahuan ditandai terbaca." };
  } catch (error) {
    return failure(error);
  }
}
