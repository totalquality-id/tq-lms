import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthTokenPurpose } from "@prisma/client";

import { db } from "@/lib/db";
import {
  ensureAuthUser,
  setAuthPassword,
  supabaseConfigured,
} from "@/lib/supabase-admin";
import { sendMail } from "@/lib/mailer";
import { dateTime } from "@/lib/utils";
import { passwordSchema } from "@/schemas/account";
import { requireAdmin } from "./access";

/**
 * Undangan berlaku seminggu: cukup lama untuk menunggu peserta yang sedang di
 * luar kota, tidak selama umur akunnya. Penyetelan ulang berlaku satu jam —
 * tautannya lahir dari permintaan yang baru saja dibuat, jadi tidak ada alasan
 * membiarkannya hidup lebih lama.
 */
const LIFETIME: Record<AuthTokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  RESET: 60 * 60 * 1000,
};

/** Hanya hash yang disimpan; token mentah hanya pernah ada di dalam tautan. */
function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Membuat token baru dan membatalkan token lain yang masih hidup untuk maksud
 * yang sama. Tanpa pembatalan itu, tautan undangan lama tetap berlaku setelah
 * administrator mengirim ulang — dan tautan yang bocor tidak dapat ditarik.
 */
async function issueToken(
  userId: string,
  purpose: AuthTokenPurpose,
  actorId?: string,
) {
  const token = randomBytes(32).toString("base64url");

  await db.$transaction([
    db.authToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + LIFETIME[purpose]),
        createdBy: actorId,
      },
    }),
  ]);

  return token;
}

function origin() {
  return process.env.AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export type Invitation = {
  email: string;
  name: string;
  url: string;
  expiresAt: Date;
  purpose: AuthTokenPurpose;
  /** Tautan sudah dikirim sebagai surel ke pemilik akun. */
  sent: boolean;
};

/**
 * Menyiapkan akun lalu mengembalikan tautan sekali pakai.
 *
 * Bila pengiriman surel dikonfigurasi, tautan itu dikirim ke pemilik akun dan
 * hasilnya menyebutkan bahwa ia terkirim. Bila tidak, tautannya tetap
 * dikembalikan untuk diteruskan administrator sendiri — tombol "kirim
 * undangan" yang sebenarnya tidak mengirim apa pun lebih berbahaya daripada
 * tautan yang jelas-jelas harus dibagikan tangan ke tangan.
 *
 * Tautannya dikembalikan dalam kedua keadaan itu. Surel dapat tertahan di
 * penyaring sampah, dan administrator yang memegang tautannya tidak perlu
 * menerbitkan tautan baru hanya untuk mencari tahu.
 */
export async function inviteUser(userId: string): Promise<Invitation> {
  const actor = await requireAdmin();

  const user = await db.user.findFirstOrThrow({
    where: { id: userId, deletedAt: null },
  });
  if (!user.active)
    throw new Error("Aktifkan kembali akun ini sebelum mengirim undangan.");
  if (user.isDemo)
    throw new Error(
      "Akun contoh tidak dapat diundang. Buat akun sungguhan untuk peserta ini.",
    );
  if (!supabaseConfigured())
    throw new Error(
      "Supabase Auth belum dikonfigurasi pada lingkungan ini, sehingga undangan tidak dapat dibuat.",
    );

  // Akun penyedia disiapkan lebih dulu supaya token tidak pernah menunjuk ke
  // akun yang belum ada — kegagalan di sini berarti tidak ada token terbit.
  const authId = user.authId ?? (await ensureAuthUser(user.email));
  if (authId !== user.authId)
    await db.user.update({ where: { id: user.id }, data: { authId } });

  const purpose: AuthTokenPurpose = user.authId ? "RESET" : "INVITE";
  const token = await issueToken(user.id, purpose, actor.id);

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: purpose === "INVITE" ? "INVITE_USER" : "RESET_PASSWORD_ISSUED",
      entity: "user",
      entityId: user.id,
    },
  });

  const record = await db.authToken.findFirstOrThrow({
    where: { tokenHash: hash(token) },
  });

  const url = `${origin()}/set-password/${token}`;
  const sent = await sendMail({
    to: user.email,
    subject:
      purpose === "INVITE"
        ? "Undangan akun TQ Learning"
        : "Penyetelan ulang kata sandi TQ Learning",
    heading:
      purpose === "INVITE"
        ? "Akun pelatihan Anda sudah siap"
        : "Setel ulang kata sandi Anda",
    lines: [
      `Halo ${user.name},`,
      purpose === "INVITE"
        ? "Administrator pelatihan Total Quality Indonesia menyiapkan akun untuk Anda. Tetapkan kata sandi melalui tombol di bawah ini."
        : "Permintaan penyetelan ulang kata sandi diterima untuk akun ini. Tetapkan kata sandi baru melalui tombol di bawah ini.",
    ],
    action: { label: "Tetapkan kata sandi", url },
    footer: `Tautan berlaku sekali pakai sampai ${dateTime(record.expiresAt)} WIB. Abaikan surel ini bila Anda tidak mengharapkannya — kata sandi Anda tidak berubah sampai tautannya dipakai.`,
  });

  return {
    email: user.email,
    name: user.name,
    url,
    expiresAt: record.expiresAt,
    purpose,
    sent,
  };
}

/**
 * Permintaan penyetelan ulang oleh pemilik akun sendiri.
 *
 * Nilai kembalinya selalu sama, ada atau tidak ada akunnya: halaman yang
 * membalas berbeda untuk email terdaftar dan tidak terdaftar berubah menjadi
 * alat untuk memastikan siapa saja yang menjadi peserta pelatihan.
 */
export async function requestPasswordReset(email: string) {
  const user = await db.user.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      active: true,
      deletedAt: null,
      isDemo: false,
    },
  });
  if (!user || !user.authId || !supabaseConfigured()) return;

  // Pembatasan sederhana: satu permintaan aktif per lima menit. Tanpa ini,
  // formulir publik dapat dipakai membanjiri satu orang dengan tautan.
  const recent = await db.authToken.findFirst({
    where: {
      userId: user.id,
      purpose: "RESET",
      usedAt: null,
      createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });
  if (recent) return;

  const token = await issueToken(user.id, "RESET");

  // Dengan surel aktif, tautannya langsung sampai ke pemiliknya. Tanpa surel,
  // permintaan ini hanya tercatat: hitungannya muncul pada daftar tindak
  // lanjut dashboard administrator, yang menjadi kotak masuk penggantinya.
  const sent = await sendMail({
    to: user.email,
    subject: "Penyetelan ulang kata sandi TQ Learning",
    heading: "Setel ulang kata sandi Anda",
    lines: [
      `Halo ${user.name},`,
      "Kami menerima permintaan penyetelan ulang kata sandi untuk akun ini.",
    ],
    action: {
      label: "Tetapkan kata sandi",
      url: `${origin()}/set-password/${token}`,
    },
    footer:
      "Tautan berlaku sekali pakai selama satu jam. Abaikan surel ini bila Anda tidak meminta penyetelan ulang — kata sandi Anda tidak berubah sampai tautannya dipakai.",
  });

  await db.notification.create({
    data: {
      userId: user.id,
      title: "Permintaan penyetelan ulang kata sandi",
      message: sent
        ? "Tautan penyetelan ulang telah dikirim ke alamat surel Anda."
        : "Tautan penyetelan ulang telah dibuat. Hubungi administrator pelatihan bila Anda tidak menerimanya.",
    },
  });
}

export type TokenHolder = {
  tokenId: string;
  name: string;
  email: string;
  purpose: AuthTokenPurpose;
};

/**
 * Memeriksa token tanpa memakainya, untuk menggambar halaman penyetelan.
 *
 * Perbandingan hash memakai timingSafeEqual: pencarian langsung berdasarkan
 * hash sebenarnya sudah aman, tetapi token yang cocok sebagian tidak boleh
 * dapat dibedakan lewat waktu tanggap pada jalur mana pun.
 */
export async function readToken(token: string): Promise<TokenHolder | null> {
  if (!token || token.length > 128) return null;

  const digest = hash(token);
  const record = await db.authToken.findUnique({
    where: { tokenHash: digest },
    include: { user: true },
  });
  if (!record) return null;

  const a = Buffer.from(record.tokenHash);
  const b = Buffer.from(digest);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (record.usedAt || record.expiresAt < new Date()) return null;
  if (!record.user.active || record.user.deletedAt || !record.user.authId)
    return null;

  return {
    tokenId: record.id,
    name: record.user.name,
    email: record.user.email,
    purpose: record.purpose,
  };
}

/**
 * Menetapkan kata sandi lalu menutup token.
 *
 * Token ditandai terpakai di dalam transaksi yang sama dengan pemeriksaannya,
 * sehingga dua pengiriman bersamaan tidak dapat memakai satu tautan dua kali.
 * Kata sandi baru disimpan ke penyedia autentikasi setelah itu; bila langkah
 * tersebut gagal, token dibuka kembali agar pemiliknya tidak kehilangan
 * satu-satunya jalan masuk yang ia punya.
 */
export async function setPasswordWithToken(
  token: string,
  input: Record<string, unknown>,
) {
  const data = passwordSchema.parse(input);
  const holder = await readToken(token);
  if (!holder)
    throw new Error(
      "Tautan ini sudah dipakai atau kedaluwarsa. Mintakan tautan baru kepada administrator.",
    );

  const claimed = await db.authToken.updateMany({
    where: { id: holder.tokenId, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0)
    throw new Error("Tautan ini baru saja dipakai. Mintakan tautan baru.");

  const record = await db.authToken.findFirstOrThrow({
    where: { id: holder.tokenId },
    include: { user: true },
  });

  try {
    await setAuthPassword(record.user.authId!, data.password);
  } catch (error) {
    await db.authToken.update({
      where: { id: holder.tokenId },
      data: { usedAt: null },
    });
    throw error;
  }

  await db.auditLog.create({
    data: {
      actorId: record.userId,
      action:
        record.purpose === "INVITE" ? "ACCOUNT_ACTIVATED" : "PASSWORD_CHANGED",
      entity: "user",
      entityId: record.userId,
    },
  });

  return { email: record.user.email };
}

/** Undangan dan reset yang masih hidup, untuk ditampilkan di daftar pengguna. */
export async function pendingTokens(userIds: string[]) {
  if (!userIds.length) return new Map<string, AuthTokenPurpose>();
  const rows = await db.authToken.findMany({
    where: {
      userId: { in: userIds },
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { userId: true, purpose: true },
  });
  return new Map(rows.map((row) => [row.userId, row.purpose]));
}
