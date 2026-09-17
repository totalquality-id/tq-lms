"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure } from "@/lib/action-result";
import {
  saveEntity,
  archiveEntity,
  reorder,
  type Entity,
} from "@/services/management";
import type { FormState } from "@/schemas/forms";
import { currentUser } from "@/services/access";
import { db } from "@/lib/db";
export async function saveAction(
  entity: Entity,
  id: string | undefined,
  parentId: string | undefined,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const savedId = await saveEntity(
      entity,
      id,
      parentId,
      Object.fromEntries(form),
    );
    revalidatePath("/", "layout");
    return {
      success: "Perubahan berhasil disimpan.",
      redirectTo:
        !id && entity === "course"
          ? `/admin/courses/${savedId}`
          : !id && entity === "batch"
            ? `/admin/training/${savedId}`
            : undefined,
    };
  } catch (e) {
    return failure(e);
  }
}
export async function archiveAction(
  entity: Entity,
  id: string,
): Promise<FormState> {
  try {
    await archiveEntity(entity, id);
    revalidatePath("/", "layout");
    return { success: "Data berhasil diperbarui." };
  } catch (e) {
    return failure(e);
  }
}
export async function reorderAction(
  entity: "module" | "lesson",
  id: string,
  direction: number,
): Promise<FormState> {
  try {
    await reorder(entity, id, direction);
    revalidatePath("/", "layout");
    return { success: "Urutan diperbarui." };
  } catch (e) {
    return failure(e);
  }
}
export async function profileAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const user = await currentUser();
    const data = z
      .object({
        name: z.string().trim().min(2).max(200),
        jobTitle: z.string().trim().max(200),
      })
      .parse(Object.fromEntries(form));
    await db.user.update({
      where: { id: user.id },
      data: { ...data, updatedBy: user.id },
    });
    revalidatePath("/", "layout");
    return { success: "Profil berhasil diperbarui." };
  } catch (e) {
    return failure(e);
  }
}
