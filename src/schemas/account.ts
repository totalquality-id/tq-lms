import { z } from "zod";

/**
 * Panjang minimum dipilih 12 karakter, bukan 8. Akun ini memegang rekam
 * pelatihan dan sertifikat yang dipakai sebagai bukti kompetensi, dan tidak ada
 * pembatasan laju pada penyedia autentikasi yang bisa kami andalkan — panjang
 * adalah pertahanan yang paling bisa diandalkan di sini.
 */
export const MIN_PASSWORD = 12;

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD, `Kata sandi minimal ${MIN_PASSWORD} karakter.`)
      .max(200, "Kata sandi terlalu panjang."),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Ulangi kata sandi yang sama.",
  })
  .refine((value) => !/^\s|\s$/.test(value.password), {
    path: ["password"],
    message: "Kata sandi tidak boleh diawali atau diakhiri spasi.",
  })
  // Menolak kata sandi yang hanya satu karakter berulang atau satu kata
  // berulang; panjang saja tidak menolong kalau isinya "aaaaaaaaaaaa".
  .refine((value) => new Set(value.password).size >= 5, {
    path: ["password"],
    message: "Gunakan kombinasi karakter yang lebih beragam.",
  });

export const forgotPasswordSchema = z.object({
  email: z.email("Masukkan email yang benar.").max(254),
});
