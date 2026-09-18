import "server-only";

import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { batchScope, isAdmin } from "@/lib/policy";
import { currentUser } from "./access";

/**
 * Pemuat data per tab pengelolaan training.
 *
 * Sebelumnya satu fungsi memuat seluruh graf objek sebuah kelas — setiap
 * pendaftaran beserta presensi, percobaan ujian, pengumpulan tugas,
 * penyelesaian pelajaran, dan evaluasinya — lalu setiap tab membayar ongkos
 * itu meski hanya menampilkan daftar materi. Di sini setiap tab menyatakan
 * sendiri apa yang dibacanya.
 *
 * Wewenangnya tetap satu: klausa `batchScope` yang sama dipakai seluruh
 * pemuat, sehingga menambah tab baru tidak pernah menjadi kesempatan untuk
 * lupa memeriksa siapa yang boleh membacanya.
 */

/** Baris peserta per halaman di dalam satu training. */
export const ROWS_PER_PAGE = 10;

type Actor = Awaited<ReturnType<typeof currentUser>>;

async function scope(id: string) {
  const user = await currentUser();
  return {
    user,
    where: {
      AND: [{ id }, batchScope(user)],
    } satisfies Prisma.TrainingBatchWhereInput,
  };
}

function result<T>(user: Actor, batch: T | null) {
  if (!batch) notFound();
  return { user, batch, admin: isAdmin(user.role) };
}

/**
 * Penyaring pendaftaran yang dipakai seluruh tab berbentuk daftar peserta.
 *
 * Peserta hanya pernah melihat barisnya sendiri. Halaman pengelolaan memang
 * tidak terbuka untuk peserta, tetapi penyaringnya tetap ditulis di sini:
 * wewenang yang bergantung pada rute mana yang kebetulan memanggil bukanlah
 * wewenang.
 */
function enrollmentWhere(
  user: Actor,
  query?: string,
): Prisma.EnrollmentWhereInput {
  const search = query?.trim();
  return {
    deletedAt: null,
    ...(user.role === "PARTICIPANT" ? { participantId: user.id } : {}),
    ...(search
      ? {
          participant: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
}

export type Paging = { page?: number; q?: string };

const slice = (page = 1) => ({
  skip: (Math.max(1, page) - 1) * ROWS_PER_PAGE,
  take: ROWS_PER_PAGE,
});

const byName = { participant: { name: "asc" } } as const;

/* -------------------------------------------------------------------------
   Kepala halaman dan ringkasan
   ------------------------------------------------------------------------- */

/**
 * Tata letak pengelolaan: judul, status, jadwal, dan angka pada tab. Hanya
 * hitungan — tata letak ini dirender ulang pada setiap tab, jadi apa pun yang
 * dibacanya dibayar berkali-kali.
 */
export async function batchLayout(id: string) {
  const { user, where } = await scope(id);
  const batch = await db.trainingBatch.findFirst({
    where,
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      organization: { select: { name: true } },
      _count: {
        select: {
          enrollments: { where: { deletedAt: null } },
          assessments: { where: { deletedAt: null } },
          assignments: { where: { deletedAt: null } },
          resources: { where: { deletedAt: null } },
        },
      },
    },
  });
  return result(user, batch);
}

/** Ringkasan training: detail, trainer, dan kurikulum course-nya. */
export async function batchOverview(id: string) {
  const { user, where } = await scope(id);
  const batch = await db.trainingBatch.findFirst({
    where,
    include: {
      course: {
        include: {
          modules: {
            orderBy: { position: "asc" },
            include: { lessons: { orderBy: { position: "asc" } } },
          },
        },
      },
      organization: true,
      trainers: { include: { trainer: true } },
      _count: {
        select: {
          assessments: { where: { deletedAt: null } },
          assignments: { where: { deletedAt: null } },
          enrollments: {
            where: { deletedAt: null, status: { not: "CANCELLED" } },
          },
        },
      },
    },
  });
  const issued = await db.certificate.count({
    where: {
      status: "ISSUED",
      enrollment: { batchId: id, deletedAt: null },
    },
  });
  return { ...result(user, batch), issued };
}

/* -------------------------------------------------------------------------
   Daftar peserta
   ------------------------------------------------------------------------- */

/**
 * Tab peserta. Presensi dimuat utuh karena persentasenya dihitung dari status
 * tiap hari, tetapi penyelesaian pelajaran cukup sebagai hitungan — daftar
 * pelajaran yang sudah dicentang tidak ditampilkan di tabel ini.
 */
export async function batchParticipants(id: string, paging: Paging = {}) {
  const { user, where } = await scope(id);
  const enrollments = enrollmentWhere(user, paging.q);

  const batch = await db.trainingBatch.findFirst({
    where,
    select: {
      id: true,
      capacity: true,
      organizationId: true,
      startDate: true,
      endDate: true,
      course: {
        select: {
          modules: {
            select: { lessons: { select: { required: true } } },
          },
        },
      },
      _count: { select: { enrollments: { where: enrollments } } },
      enrollments: {
        where: enrollments,
        orderBy: byName,
        ...slice(paging.page),
        select: {
          id: true,
          status: true,
          participant: { select: { name: true, email: true } },
          certificate: { select: { number: true, status: true } },
          attendance: { select: { status: true } },
          _count: { select: { lessons: true } },
        },
      },
    },
  });
  return result(user, batch);
}

/** Tab presensi: satu baris peserta dengan seluruh hari yang sudah ditandai. */
export async function batchAttendance(id: string, paging: Paging = {}) {
  const { user, where } = await scope(id);
  const enrollments = enrollmentWhere(user, paging.q);

  const batch = await db.trainingBatch.findFirst({
    where,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      minimumAttendance: true,
      _count: { select: { enrollments: { where: enrollments } } },
      enrollments: {
        where: enrollments,
        orderBy: byName,
        ...slice(paging.page),
        select: {
          id: true,
          participant: { select: { name: true } },
          attendance: { select: { date: true, status: true } },
        },
      },
    },
  });
  return result(user, batch);
}

/* -------------------------------------------------------------------------
   Penilaian
   ------------------------------------------------------------------------- */

/**
 * Tab penilaian: daftar penilaian, dan tabel nilai peserta yang berhalaman.
 *
 * Jumlah peserta yang sudah mengerjakan dihitung dengan query tersendiri, bukan
 * dari baris yang sedang ditampilkan. Menghitungnya dari satu halaman akan
 * melaporkan "3 dari 40 mengerjakan" hanya karena pembacanya sedang berada di
 * halaman pertama.
 */
export async function batchAssessments(id: string, paging: Paging = {}) {
  const { user, where } = await scope(id);
  const enrollments = enrollmentWhere(user, paging.q);

  const batch = await db.trainingBatch.findFirst({
    where,
    select: {
      id: true,
      courseId: true,
      assessments: { where: { deletedAt: null }, orderBy: { type: "asc" } },
      _count: { select: { enrollments: { where: enrollments } } },
      enrollments: {
        where: enrollments,
        orderBy: byName,
        ...slice(paging.page),
        select: {
          id: true,
          participant: { select: { name: true } },
          attempts: {
            select: {
              assessmentId: true,
              score: true,
              passed: true,
              submittedAt: true,
            },
          },
        },
      },
    },
  });
  if (!batch) notFound();

  const worked = await db.assessmentAttempt.findMany({
    where: {
      assessment: { batchId: id, deletedAt: null },
      submittedAt: { not: null },
      enrollment: { deletedAt: null },
    },
    select: { assessmentId: true, enrollmentId: true },
    distinct: ["assessmentId", "enrollmentId"],
  });
  const attempted = new Map<string, number>();
  for (const row of worked)
    attempted.set(row.assessmentId, (attempted.get(row.assessmentId) ?? 0) + 1);

  const participants = await db.enrollment.count({
    where: { ...enrollmentWhere(user), batchId: id },
  });

  return { ...result(user, batch), attempted, participants };
}

/* -------------------------------------------------------------------------
   Tugas
   ------------------------------------------------------------------------- */

/**
 * Tab tugas: setiap tugas beserta pengumpulannya.
 *
 * Tidak berhalaman karena yang dibaca trainer adalah pekerjaan yang menunggu,
 * bukan daftar peserta — dan pengumpulan tidak ikut membawa presensi, percobaan
 * ujian, atau penyelesaian pelajaran seperti dulu. Satu kelas berisi puluhan
 * peserta dan beberapa tugas menghasilkan baris yang ringan dan berbatas.
 */
export async function batchAssignments(id: string) {
  const { user, where } = await scope(id);
  const participantScope = enrollmentWhere(user);

  const batch = await db.trainingBatch.findFirst({
    where,
    select: {
      id: true,
      assignments: {
        where: { deletedAt: null },
        orderBy: { dueAt: "asc" },
        include: {
          submissions: {
            where: { enrollment: participantScope },
            orderBy: { enrollment: { participant: { name: "asc" } } },
            select: {
              id: true,
              assignmentId: true,
              status: true,
              score: true,
              feedback: true,
              link: true,
              storageKey: true,
              submittedAt: true,
              enrollment: {
                select: { participant: { select: { name: true } } },
              },
            },
          },
        },
      },
      _count: { select: { enrollments: { where: participantScope } } },
    },
  });
  return result(user, batch);
}

/* -------------------------------------------------------------------------
   Materi, evaluasi, sertifikat
   ------------------------------------------------------------------------- */

export async function batchResources(id: string) {
  const { user, where } = await scope(id);
  const batch = await db.trainingBatch.findFirst({
    where,
    select: {
      id: true,
      resources: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          url: true,
          storageKey: true,
          size: true,
          createdAt: true,
        },
      },
    },
  });
  return result(user, batch);
}

export async function batchEvaluation(id: string) {
  const { user, where } = await scope(id);
  const batch = await db.trainingBatch.findFirst({
    where,
    select: {
      id: true,
      evaluation: { select: { id: true, open: true } },
      _count: { select: { enrollments: { where: enrollmentWhere(user) } } },
    },
  });
  return result(user, batch);
}

/**
 * Tab sertifikat. Pemeriksaan kelulusan membutuhkan presensi, percobaan, dan
 * pengumpulan sekaligus, jadi baris peserta di sini memang berat — justru
 * karena itu ia berhalaman.
 */
export async function batchCertificates(id: string, paging: Paging = {}) {
  const { user, where } = await scope(id);
  const enrollments: Prisma.EnrollmentWhereInput = {
    ...enrollmentWhere(user, paging.q),
    status: { not: "CANCELLED" },
  };

  const batch = await db.trainingBatch.findFirst({
    where,
    select: { id: true, minimumAttendance: true },
  });
  if (!batch) notFound();

  const [rows, total] = await Promise.all([
    db.enrollment.findMany({
      where: { ...enrollments, batchId: id },
      orderBy: byName,
      ...slice(paging.page),
      include: {
        participant: true,
        attendance: true,
        attempts: { include: { assessment: true } },
        submissions: { include: { assignment: true } },
        evaluations: true,
        certificate: true,
        batch: {
          include: {
            course: true,
            organization: true,
            trainers: { include: { trainer: true } },
            assessments: { where: { deletedAt: null } },
            assignments: { where: { deletedAt: null, published: true } },
            evaluation: true,
          },
        },
      },
    }),
    db.enrollment.count({ where: { ...enrollments, batchId: id } }),
  ]);

  return { ...result(user, batch), rows, total };
}

/* -------------------------------------------------------------------------
   Tampilan PIC perusahaan
   ------------------------------------------------------------------------- */

/** Halaman training untuk PIC: kemajuan karyawannya, berhalaman. */
export async function organizationBatch(id: string, paging: Paging = {}) {
  const { user, where } = await scope(id);
  const enrollments: Prisma.EnrollmentWhereInput = {
    ...enrollmentWhere(user, paging.q),
    status: { not: "CANCELLED" },
  };

  const batch = await db.trainingBatch.findFirst({
    where,
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      mode: true,
      venue: true,
      startDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
      course: {
        select: {
          title: true,
          modules: { select: { lessons: { select: { required: true } } } },
        },
      },
      trainers: { select: { trainer: { select: { name: true } } } },
      assessments: {
        where: { deletedAt: null, type: "FINAL_EXAM" },
        select: { id: true, title: true },
      },
      _count: {
        select: {
          enrollments: { where: enrollments },
        },
      },
      enrollments: {
        where: enrollments,
        orderBy: byName,
        ...slice(paging.page),
        select: {
          id: true,
          status: true,
          participant: {
            select: { name: true, email: true, jobTitle: true },
          },
          attendance: { select: { status: true } },
          attempts: {
            select: { assessmentId: true, score: true, submittedAt: true },
          },
          certificate: { select: { number: true, status: true } },
          _count: { select: { lessons: true } },
        },
      },
    },
  });
  if (!batch) notFound();

  const [completed, issued] = await Promise.all([
    db.enrollment.count({
      where: { batchId: id, deletedAt: null, status: "COMPLETED" },
    }),
    db.certificate.count({
      where: {
        status: "ISSUED",
        enrollment: { batchId: id, deletedAt: null },
      },
    }),
  ]);

  return { ...result(user, batch), completed, issued };
}
