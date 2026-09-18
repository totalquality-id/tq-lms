"use server";

import { revalidatePath } from "next/cache";

import { failure } from "@/lib/action-result";
import { forgotPasswordSchema } from "@/schemas/account";
import type { FormState } from "@/schemas/forms";
import {
  inviteUser,
  requestPasswordReset,
  setPasswordWithToken,
  type Invitation,
} from "@/services/account";

export type InviteState = FormState & { invitation?: Invitation };

/**
 * Menyiapkan akun lalu mengembalikan tautan sekali pakai. Tautannya ikut
 * dikirim sebagai surel bila pengiriman surel dikonfigurasi, dan tetap
 * ditampilkan kepada administrator dalam kedua keadaan — lihat catatan pada
 * inviteUser.
 */
export async function inviteAction(userId: string): Promise<InviteState> {
  try {
    const invitation = await inviteUser(userId);
    revalidatePath("/admin/users");
    revalidatePath("/admin/participants");
    revalidatePath("/admin/trainers");
    const what =
      invitation.purpose === "INVITE" ? "Undangan" : "Tautan penyetelan ulang";
    return {
      success: invitation.sent
        ? `${what} dikirim ke ${invitation.email}.`
        : `${what} dibuat. Bagikan tautannya kepada pemilik akun.`,
      invitation,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function forgotPasswordAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const { email } = forgotPasswordSchema.parse(Object.fromEntries(form));
    await requestPasswordReset(email);
  } catch (error) {
    // Galat validasi tetap dilaporkan; sisanya tidak, karena membedakan
    // jawaban akan memberi tahu penebak mana email yang terdaftar.
    const result = failure(error);
    if (result.fields) return result;
  }
  return {
    success:
      "Permintaan Anda tercatat. Administrator pelatihan akan meneruskan tautan penyetelan ulang kepada Anda.",
  };
}

export async function setPasswordAction(
  token: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await setPasswordWithToken(token, Object.fromEntries(form));
    return {
      success: "Kata sandi tersimpan. Silakan masuk dengan kata sandi baru.",
      redirectTo: "/login",
    };
  } catch (error) {
    return failure(error);
  }
}
