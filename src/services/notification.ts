import "server-only";

import { after } from "next/server";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { currentUser } from "./access";

/**
 * Pemberitahuan dalam aplikasi, dan surel bagi yang memang layak menyela hari
 * seseorang.
 *
 * Barisnya selalu ditulis; surel hanya menyertai sebagian kecil. Sertifikat
 * terbit dan tugas selesai dinilai adalah kabar yang ditunggu dan tidak akan
 * dilihat peserta bila ia tidak kebetulan membuka aplikasi. Materi baru dan
 * tugas masuk cukup menunggu di bel — mengirimkannya sebagai surel akan
 * mengubah pemberitahuan menjadi sesuatu yang orang matikan seluruhnya.
 */

/** Jumlah pemberitahuan yang ditampilkan di panel bel. */
const PANEL_SIZE = 8;

type Client = Prisma.TransactionClient | typeof db;

export type Notice = {
  title: string;
  message: string;
  href?: string;
  /** Kirim juga sebagai surel, bila pengiriman surel dikonfigurasi. */
  email?: boolean;
};

function origin() {
  return process.env.AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/**
 * Menjalankan pengiriman surel setelah tanggapan selesai dikirim.
 *
 * Peserta tidak perlu menunggu penyedia surel menjawab sebelum melihat bahwa
 * sertifikatnya terbit. `after` tidak tersedia di luar konteks permintaan —
 * seed dan skrip memanggil fungsi yang sama — jadi kegagalannya ditangani
 * dengan menjalankan pekerjaan itu di tempat.
 */
function background(work: () => Promise<unknown>) {
  try {
    after(work);
  } catch {
    void work().catch((error) => console.error("notifikasi:", error));
  }
}

async function deliver(userIds: string[], notice: Notice) {
  if (!notice.email || !mailConfigured() || !userIds.length) return;
  const recipients = await db.user.findMany({
    where: {
      id: { in: userIds },
      active: true,
      deletedAt: null,
      isDemo: false,
    },
    select: { email: true, name: true },
  });
  for (const recipient of recipients)
    await sendMail({
      to: recipient.email,
      subject: notice.title,
      heading: notice.title,
      lines: [`Halo ${recipient.name},`, notice.message],
      action: notice.href
        ? { label: "Buka TQ Learning", url: `${origin()}${notice.href}` }
        : undefined,
    });
}

/**
 * Satu pemberitahuan untuk satu orang. Menerima klien transaksi supaya barisnya
 * lahir bersama mutasi yang menyebabkannya: sertifikat yang gagal tersimpan
 * tidak boleh meninggalkan kabar bahwa ia terbit.
 */
export async function notify(userId: string, notice: Notice, tx?: Client) {
  await (tx ?? db).notification.create({
    data: {
      userId,
      title: notice.title,
      message: notice.message,
      href: notice.href ?? null,
    },
  });
  background(() => deliver([userId], notice));
}

async function notifyAll(userIds: string[], notice: Notice) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return;
  await db.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      title: notice.title,
      message: notice.message,
      href: notice.href ?? null,
    })),
  });
  background(() => deliver(unique, notice));
}

/** Seluruh peserta aktif satu kelas. */
export async function notifyParticipants(batchId: string, notice: Notice) {
  const enrollments = await db.enrollment.findMany({
    where: {
      batchId,
      deletedAt: null,
      status: { not: "CANCELLED" },
      participant: { active: true, deletedAt: null },
    },
    select: { participantId: true },
  });
  await notifyAll(
    enrollments.map((enrollment) => enrollment.participantId),
    notice,
  );
}

/**
 * Trainer yang ditugaskan pada satu kelas. Administrator tidak ikut: mereka
 * membaca pekerjaan yang menunggu dari daftar di dashboard, dan menyalin
 * setiap pengumpulan tugas ke bel mereka akan menenggelamkan kabar yang
 * benar-benar ditujukan kepada mereka.
 */
export async function notifyBatchStaff(batchId: string, notice: Notice) {
  const trainers = await db.trainingBatchTrainer.findMany({
    where: { batchId, trainer: { active: true, deletedAt: null } },
    select: { trainerId: true },
  });
  await notifyAll(
    trainers.map((link) => link.trainerId),
    notice,
  );
}

/* -------------------------------------------------------------------------
   Pembacaan
   ------------------------------------------------------------------------- */

export type NotificationPanel = {
  unread: number;
  items: {
    id: string;
    title: string;
    message: string;
    href: string | null;
    createdAt: Date;
    read: boolean;
  }[];
};

/**
 * Isi panel bel: jumlah yang belum dibaca dan beberapa kabar terakhir.
 *
 * Yang sudah dibaca tetap ditampilkan. Panel yang mengosongkan dirinya sendiri
 * begitu dibuka membuat orang kehilangan kabar yang baru saja ia lihat sekilas.
 */
export async function notificationPanel(): Promise<NotificationPanel> {
  const user = await currentUser();
  const [unread, items] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: PANEL_SIZE,
    }),
  ]);

  return {
    unread,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      href: item.href,
      createdAt: item.createdAt,
      read: item.readAt !== null,
    })),
  };
}

/** Menandai satu pemberitahuan terbaca. Hanya milik pembacanya sendiri. */
export async function markRead(id: string) {
  const user = await currentUser();
  await db.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead() {
  const user = await currentUser();
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}
