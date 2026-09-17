import { PrismaClient, UserRole, TrainingStatus } from "@prisma/client";
import { EVALUATION_TEMPLATE } from "../src/lib/evaluation-template";
const db = new PrismaClient();
async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_DEMO_AUTH !== "true"
  )
    throw new Error(
      "Demo seed is restricted to explicitly enabled development environments.",
    );
  const orgs = [
    {
      id: "org-globalindo",
      name: "PT Globalindo Intimates",
      industry: "Textile & Garment",
      email: "learning@globalindo.local",
      address: "Sukoharjo, Jawa Tengah",
    },
    {
      id: "org-nusantara",
      name: "PT Nusantara Manufacturing",
      industry: "Manufacturing",
      email: "hr@nusantara.local",
      address: "Bekasi, Jawa Barat",
    },
    {
      id: "org-prima",
      name: "PT Prima Teknologi Indonesia",
      industry: "Technology",
      email: "people@prima.local",
      address: "Jakarta Selatan",
    },
  ];
  for (const o of orgs)
    await db.organization.upsert({
      where: { id: o.id },
      create: o,
      update: {},
    });
  const users = [
    {
      id: "user-admin",
      name: "Ammar",
      email: "admin@totalquality.local",
      role: UserRole.SUPER_ADMIN,
      jobTitle: "Learning Administrator",
    },
    {
      id: "user-trainer",
      name: "Budi Santoso",
      email: "trainer@totalquality.local",
      role: UserRole.TRAINER,
      jobTitle: "Lead Trainer · ISO & Management Systems",
    },
    {
      id: "user-pic",
      name: "Rina Wijaya",
      email: "pic@globalindo.local",
      role: UserRole.CORPORATE_PIC,
      jobTitle: "HR & Learning Development",
    },
  ];
  for (const u of users)
    await db.user.upsert({
      where: { id: u.id },
      create: { ...u, isDemo: true },
      update: {},
    });
  await db.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: "org-globalindo",
        userId: "user-pic",
      },
    },
    create: {
      organizationId: "org-globalindo",
      userId: "user-pic",
      isPic: true,
    },
    update: {},
  });
  const names = [
    "Ahmad Fauzi",
    "Dewi Lestari",
    "Andi Pratama",
    "Siti Rahmawati",
    "Rizky Maulana",
    "Nadia Putri",
    "Fajar Hidayat",
    "Indah Permata",
    "Dimas Saputra",
    "Putri Ayuningtyas",
  ];
  for (let i = 0; i < names.length; i++) {
    const id = `participant-${i + 1}`;
    await db.user.upsert({
      where: { id },
      create: {
        id,
        name: names[i],
        email:
          i === 0
            ? "participant@globalindo.local"
            : `participant${i + 1}@globalindo.local`,
        role: "PARTICIPANT",
        isDemo: true,
        jobTitle: ["Quality Assurance", "Human Resources", "IT & Security"][
          i % 3
        ],
      },
      update: {},
    });
    await db.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: "org-globalindo", userId: id },
      },
      create: { organizationId: "org-globalindo", userId: id },
      update: {},
    });
  }
  const courses = [
    {
      id: "course-isms",
      code: "ISMS",
      title: "ISO/IEC 27001:2022 Awareness",
      slug: "iso-27001-awareness",
      category: "Information Security",
      shortDescription:
        "Pahami prinsip keamanan informasi dan penerapan sistem manajemen ISO/IEC 27001:2022.",
      duration: 24,
      published: true,
      objectives:
        "Memahami prinsip kerahasiaan, integritas, dan ketersediaan.\nMengenali struktur dan persyaratan ISO/IEC 27001.\nMengidentifikasi risiko keamanan informasi di lingkungan kerja.",
    },
    {
      id: "course-qms",
      code: "QMS",
      title: "ISO 9001:2015 Internal Auditor",
      slug: "iso-9001-internal-auditor",
      category: "Quality Management",
      shortDescription:
        "Kembangkan keterampilan merencanakan dan melaksanakan audit internal sistem manajemen mutu.",
      duration: 16,
      published: true,
      objectives:
        "Memahami proses audit internal.\nMenyusun temuan dan rencana tindak lanjut.",
    },
    {
      id: "course-ohs",
      code: "OHS",
      title: "ISO 45001:2018 Awareness",
      slug: "iso-45001-awareness",
      category: "Health & Safety",
      shortDescription:
        "Bangun budaya keselamatan kerja melalui pemahaman sistem manajemen K3.",
      duration: 8,
      published: true,
      objectives:
        "Mengenali bahaya dan risiko K3.\nMemahami tanggung jawab keselamatan kerja.",
    },
    {
      id: "course-kaizen",
      code: "KAIZEN",
      title: "Kaizen & Continuous Improvement",
      slug: "kaizen-improvement",
      category: "Continuous Improvement",
      shortDescription:
        "Mulai perbaikan berkelanjutan yang sederhana, terukur, dan berdampak di tempat kerja.",
      duration: 8,
      published: false,
      objectives: "Memahami PDCA dan budaya perbaikan berkelanjutan.",
    },
  ];
  for (const c of courses)
    await db.course.upsert({
      where: { id: c.id },
      create: {
        ...c,
        description: c.shortDescription,
        passingGrade: 70,
        createdBy: "user-admin",
      },
      // Kode sertifikat ikut diperbarui: nomor sertifikat dibangun darinya,
      // dan seed lama menuliskan nilai bawaan "TQ" untuk seluruh course.
      update: { code: c.code },
    });
  const modules = [
    "Introduction to ISMS",
    "ISO/IEC 27001 Overview",
    "Clause 4 — Context of the Organization",
    "Clause 5 — Leadership",
    "Clause 6 — Planning",
    "Annex A Controls",
  ];
  const lessons = [
    [
      "Mengapa keamanan informasi penting?",
      "Prinsip confidentiality, integrity, dan availability",
    ],
    ["Mengenal ISO/IEC 27001:2022", "Struktur dan pendekatan berbasis risiko"],
    ["Memahami konteks organisasi", "Kebutuhan pihak berkepentingan"],
    ["Komitmen dan tanggung jawab pimpinan", "Kebijakan keamanan informasi"],
    ["Identifikasi dan penilaian risiko", "Rencana perlakuan risiko"],
    ["Kontrol organisasi dan manusia", "Kontrol fisik dan teknologi"],
  ];
  for (let i = 0; i < modules.length; i++) {
    const moduleId = `module-isms-${i + 1}`;
    await db.courseModule.upsert({
      where: { id: moduleId },
      create: {
        id: moduleId,
        courseId: "course-isms",
        title: modules[i],
        position: i + 1,
      },
      update: {},
    });
    for (let j = 0; j < 2; j++) {
      const id = `lesson-isms-${i + 1}-${j + 1}`;
      await db.lesson.upsert({
        where: { id },
        create: {
          id,
          moduleId,
          title: lessons[i][j],
          position: j + 1,
          duration: 20,
          content: `${lessons[i][j]}\n\nKeamanan informasi merupakan tanggung jawab setiap anggota organisasi. Sistem manajemen membantu organisasi mengenali risiko, menetapkan kontrol yang tepat, serta mengevaluasi efektivitasnya secara berkelanjutan.\n\nDalam sesi ini, diskusikan bersama trainer bagaimana prinsip ini diterapkan dalam aktivitas kerja Anda. Identifikasi informasi yang perlu dilindungi, siapa yang memiliki akses, dan dampak jika informasi tersebut tidak tersedia atau berubah tanpa izin.\n\nRefleksi: sebutkan satu risiko yang pernah Anda temui di lingkungan kerja dan tindakan sederhana untuk menguranginya.\n\nMateri contoh untuk pratinjau platform. Trainer dapat mengganti isi ini dengan materi pelatihan yang telah disetujui.`,
        },
        update: {},
      });
    }
  }
  for (const c of courses.slice(1)) {
    await db.courseModule.upsert({
      where: { id: `module-${c.id}` },
      create: {
        id: `module-${c.id}`,
        courseId: c.id,
        title: "Dasar dan penerapan",
        position: 1,
        lessons: {
          create: {
            title: "Pengantar dan tujuan pelatihan",
            content: c.shortDescription,
            position: 1,
            duration: 30,
          },
        },
      },
      update: {},
    });
  }
  const batches = [
    {
      id: "training-isms-sept",
      code: "TQI-ISMS-2026-009",
      title: "ISO/IEC 27001:2022 Awareness",
      courseId: "course-isms",
      organizationId: "org-globalindo",
      startDate: new Date("2026-09-16T02:00:00Z"),
      endDate: new Date("2026-09-18T09:00:00Z"),
      status: TrainingStatus.ONGOING,
    },
    {
      id: "training-qms-sept",
      code: "TQI-QMS-2026-012",
      title: "ISO 9001:2015 Internal Auditor",
      courseId: "course-qms",
      organizationId: "org-nusantara",
      startDate: new Date("2026-09-21T02:00:00Z"),
      endDate: new Date("2026-09-22T09:00:00Z"),
      status: TrainingStatus.OPEN,
    },
    {
      id: "training-ohs-sept",
      code: "TQI-OHS-2026-007",
      title: "ISO 45001:2018 Awareness",
      courseId: "course-ohs",
      organizationId: "org-prima",
      startDate: new Date("2026-09-24T02:00:00Z"),
      endDate: new Date("2026-09-24T09:00:00Z"),
      status: TrainingStatus.OPEN,
    },
    {
      id: "training-qms-globalindo",
      code: "TQI-QMS-2026-013",
      title: "ISO 9001:2015 Internal Auditor",
      courseId: "course-qms",
      organizationId: "org-globalindo",
      startDate: new Date("2026-09-28T02:00:00Z"),
      endDate: new Date("2026-09-29T09:00:00Z"),
      status: TrainingStatus.OPEN,
    },
    {
      id: "training-isms-july",
      code: "TQI-ISMS-2026-006",
      title: "ISO/IEC 27001:2022 Awareness",
      courseId: "course-isms",
      organizationId: "org-globalindo",
      startDate: new Date("2026-07-01T02:00:00Z"),
      endDate: new Date("2026-07-03T09:00:00Z"),
      status: TrainingStatus.COMPLETED,
    },
  ];
  for (const b of batches) {
    await db.trainingBatch.upsert({
      where: { id: b.id },
      create: {
        ...b,
        mode: "OFFLINE",
        venue: "Ruang Training · Kantor Klien",
        capacity: 25,
        createdBy: "user-admin",
        description:
          "Pelatihan interaktif bersama fasilitator Total Quality Indonesia.",
      },
      update: {},
    });
    if (b.id !== "training-ohs-sept")
      await db.trainingBatchTrainer.upsert({
        where: {
          batchId_trainerId: { batchId: b.id, trainerId: "user-trainer" },
        },
        create: { batchId: b.id, trainerId: "user-trainer" },
        update: {},
      });
  }
  for (let i = 1; i <= 10; i++) {
    for (const batchId of [
      "training-isms-sept",
      "training-isms-july",
      ...(i <= 5 ? ["training-qms-globalindo"] : []),
    ]) {
      await db.enrollment.upsert({
        where: {
          batchId_participantId: { batchId, participantId: `participant-${i}` },
        },
        create: {
          batchId,
          participantId: `participant-${i}`,
          status:
            batchId === "training-isms-july"
              ? "COMPLETED"
              : batchId === "training-isms-sept"
                ? "IN_PROGRESS"
                : "ENROLLED",
          createdBy: "user-admin",
        },
        update: {},
      });
    }
  }

  /* ---------------------------------------------------------------------
     Bank soal
     --------------------------------------------------------------------- */

  type SeedQuestion = {
    id: string;
    topic: string;
    difficulty: string;
    type:
      | "SINGLE_CHOICE"
      | "MULTIPLE_CHOICE"
      | "TRUE_FALSE"
      | "SHORT_TEXT"
      | "ESSAY";
    text: string;
    points?: number;
    correctText?: string;
    options?: [string, boolean][];
  };

  const questions: SeedQuestion[] = [
    {
      id: "q-isms-cia",
      topic: "Prinsip keamanan informasi",
      difficulty: "EASY",
      type: "SINGLE_CHOICE",
      text: "Apa tiga prinsip utama keamanan informasi?",
      options: [
        ["Confidentiality, Integrity, Availability", true],
        ["Cost, Income, Assets", false],
        ["Planning, Doing, Checking", false],
        ["People, Process, Product", false],
      ],
    },
    {
      id: "q-isms-scope",
      topic: "Klausul 4 — Konteks organisasi",
      difficulty: "MEDIUM",
      type: "SINGLE_CHOICE",
      text: "Dokumen apa yang menetapkan batasan penerapan sistem manajemen keamanan informasi?",
      options: [
        ["Ruang lingkup ISMS", true],
        ["Kebijakan cuti karyawan", false],
        ["Laporan keuangan tahunan", false],
        ["Prosedur pengadaan barang", false],
      ],
    },
    {
      id: "q-isms-interested",
      topic: "Klausul 4 — Konteks organisasi",
      difficulty: "MEDIUM",
      type: "MULTIPLE_CHOICE",
      text: "Pihak mana saja yang dapat menjadi pihak berkepentingan dalam ISMS? Pilih semua yang benar.",
      points: 2,
      options: [
        ["Pelanggan", true],
        ["Regulator", true],
        ["Pemasok", true],
        ["Pesaing yang tidak memiliki hubungan kerja", false],
      ],
    },
    {
      id: "q-isms-leadership",
      topic: "Klausul 5 — Kepemimpinan",
      difficulty: "EASY",
      type: "TRUE_FALSE",
      text: "Penetapan kebijakan keamanan informasi merupakan tanggung jawab manajemen puncak.",
      options: [
        ["Benar", true],
        ["Salah", false],
      ],
    },
    {
      id: "q-isms-risk-owner",
      topic: "Klausul 6 — Perencanaan",
      difficulty: "MEDIUM",
      type: "SINGLE_CHOICE",
      text: "Siapa yang menyetujui rencana perlakuan risiko dan menerima risiko residual?",
      options: [
        ["Pemilik risiko", true],
        ["Auditor eksternal", false],
        ["Seluruh karyawan", false],
        ["Penyedia layanan cloud", false],
      ],
    },
    {
      id: "q-isms-soa",
      topic: "Klausul 6 — Perencanaan",
      difficulty: "HARD",
      type: "SHORT_TEXT",
      text: "Dokumen yang mencantumkan kontrol Annex A yang diterapkan beserta justifikasinya disebut …",
      correctText: "Statement of Applicability|SoA|Pernyataan Keberlakuan",
    },
    {
      id: "q-isms-annexa",
      topic: "Annex A",
      difficulty: "MEDIUM",
      type: "MULTIPLE_CHOICE",
      text: "Manakah yang termasuk kelompok kontrol pada Annex A ISO/IEC 27001:2022?",
      points: 2,
      options: [
        ["Kontrol organisasi", true],
        ["Kontrol orang", true],
        ["Kontrol fisik", true],
        ["Kontrol pemasaran", false],
      ],
    },
    {
      id: "q-isms-incident",
      topic: "Annex A",
      difficulty: "EASY",
      type: "SINGLE_CHOICE",
      text: "Tindakan pertama yang tepat ketika menemukan dugaan insiden keamanan informasi adalah …",
      options: [
        ["Melaporkannya melalui jalur pelaporan insiden yang ditetapkan", true],
        ["Menghapus jejaknya agar tidak menimbulkan kepanikan", false],
        ["Membicarakannya di media sosial", false],
        ["Menunggu sampai audit berikutnya", false],
      ],
    },
    {
      id: "q-isms-password",
      topic: "Prinsip keamanan informasi",
      difficulty: "EASY",
      type: "TRUE_FALSE",
      text: "Berbagi kata sandi akun kerja dengan rekan satu tim diperbolehkan selama rekan tersebut dapat dipercaya.",
      options: [
        ["Benar", false],
        ["Salah", true],
      ],
    },
    {
      id: "q-isms-classification",
      topic: "Annex A",
      difficulty: "MEDIUM",
      type: "SINGLE_CHOICE",
      text: "Tujuan utama klasifikasi informasi adalah …",
      options: [
        [
          "Menentukan tingkat perlindungan yang sepadan dengan nilai informasi",
          true,
        ],
        ["Mengurangi jumlah dokumen yang disimpan", false],
        ["Mempercepat proses rekrutmen", false],
        ["Menghemat biaya lisensi perangkat lunak", false],
      ],
    },
    {
      id: "q-isms-essay-apply",
      topic: "Penerapan di tempat kerja",
      difficulty: "HARD",
      type: "ESSAY",
      text: "Sebutkan satu risiko keamanan informasi pada unit kerja Anda, lalu jelaskan kontrol yang Anda usulkan beserta alasannya.",
      points: 5,
    },
    {
      id: "q-qms-audit",
      topic: "Audit internal",
      difficulty: "MEDIUM",
      type: "SINGLE_CHOICE",
      text: "Bukti audit yang paling kuat untuk memverifikasi penerapan suatu proses adalah …",
      options: [
        ["Rekaman pelaksanaan proses pada periode berjalan", true],
        ["Pernyataan lisan auditee", false],
        ["Bagan organisasi", false],
        ["Rencana audit tahun lalu", false],
      ],
    },
  ];

  // Seed terdahulu meninggalkan satu soal contoh dengan pilihan yang belum
  // lengkap. Dibuang di sini supaya workspace yang pernah di-seed menyatu
  // dengan keadaan sekarang, bukan menyimpan dua versi soal yang sama.
  await db.assessmentQuestion.deleteMany({
    where: {
      OR: [
        { questionId: "question-demo-cia" },
        { assessmentId: "assessment-demo-pre" },
      ],
    },
  });
  await db.questionOption.deleteMany({
    where: { questionId: "question-demo-cia" },
  });
  await db.question.deleteMany({ where: { id: "question-demo-cia" } });
  await db.assessment.deleteMany({ where: { id: "assessment-demo-pre" } });

  for (const q of questions)
    await db.question.upsert({
      where: { id: q.id },
      create: {
        id: q.id,
        courseId: q.id.startsWith("q-qms") ? "course-qms" : "course-isms",
        topic: q.topic,
        difficulty: q.difficulty,
        type: q.type,
        text: q.text,
        points: q.points ?? 1,
        correctText: q.correctText ?? null,
        options: q.options
          ? {
              create: q.options.map(([text, correct], index) => ({
                text,
                correct,
                position: index + 1,
              })),
            }
          : undefined,
      },
      update: {},
    });

  /* ---------------------------------------------------------------------
     Penilaian, tugas, materi pendukung, dan evaluasi
     --------------------------------------------------------------------- */

  const assessments = [
    {
      id: "assessment-july-pre",
      batchId: "training-isms-july",
      title: "Pre-Test ISO/IEC 27001",
      type: "PRE_TEST" as const,
      passingGrade: 0,
      questionLimit: 5,
    },
    {
      id: "assessment-july-final",
      batchId: "training-isms-july",
      title: "Ujian Akhir ISO/IEC 27001",
      type: "FINAL_EXAM" as const,
      passingGrade: 70,
      questionLimit: 10,
    },
    {
      id: "assessment-sept-pre",
      batchId: "training-isms-sept",
      title: "Pre-Test ISO/IEC 27001",
      type: "PRE_TEST" as const,
      passingGrade: 0,
      questionLimit: 5,
    },
    {
      id: "assessment-sept-final",
      batchId: "training-isms-sept",
      title: "Ujian Akhir ISO/IEC 27001",
      type: "FINAL_EXAM" as const,
      passingGrade: 70,
      questionLimit: 10,
    },
  ];

  for (const a of assessments)
    await db.assessment.upsert({
      where: { id: a.id },
      create: {
        ...a,
        instructions:
          "Kerjakan seluruh soal. Jawaban dikirim satu kali; periksa kembali sebelum menekan tombol kirim.",
        durationMinutes: a.type === "FINAL_EXAM" ? 45 : 20,
        maxAttempts: a.type === "FINAL_EXAM" ? 2 : 1,
        randomizeQuestions: true,
        randomizeOptions: true,
        showResult: true,
        published: true,
      },
      update: { published: true },
    });

  for (const a of [
    {
      id: "assignment-july-risk",
      batchId: "training-isms-july",
      dueAt: new Date("2026-07-10T16:00:00+07:00"),
    },
    {
      id: "assignment-sept-risk",
      batchId: "training-isms-sept",
      dueAt: new Date("2026-09-30T16:00:00+07:00"),
    },
  ])
    await db.assignment.upsert({
      where: { id: a.id },
      create: {
        ...a,
        title: "Register risiko unit kerja",
        instructions:
          "Susun register risiko keamanan informasi untuk unit kerja Anda: minimal lima risiko, penilaian dampak dan kemungkinan, pemilik risiko, serta kontrol yang diusulkan. Simpan berkas pada drive perusahaan Anda, lalu bagikan tautannya melalui formulir pengumpulan.",
        maxScore: 100,
        required: true,
        published: true,
        allowedTypes: [],
      },
      update: { published: true },
    });

  for (const r of [
    {
      id: "resource-sept-slide",
      title: "Slide pelatihan — ISO/IEC 27001:2022 Awareness",
      description: "Materi presentasi yang dipakai trainer selama kelas.",
      url: "https://example.com/tqi/iso27001-awareness-slide.pdf",
    },
    {
      id: "resource-sept-template",
      title: "Template register risiko",
      description: "Lembar kerja untuk tugas register risiko.",
      url: "https://example.com/tqi/template-register-risiko.xlsx",
    },
  ])
    await db.trainingResource.upsert({
      where: { id: r.id },
      create: { ...r, batchId: "training-isms-sept", createdBy: "user-trainer" },
      update: {},
    });

  for (const batchId of ["training-isms-july", "training-isms-sept"])
    await db.trainingEvaluation.upsert({
      where: { batchId },
      create: {
        batchId,
        questions: EVALUATION_TEMPLATE,
        open: batchId === "training-isms-sept",
      },
      update: {},
    });

  /* ---------------------------------------------------------------------
     Riwayat kelas yang sudah selesai — Juli 2026

     Kelas ini menjadi contoh siklus penuh: presensi tercatat, pre-test dan
     ujian akhir dikerjakan, tugas dinilai, evaluasi terisi, sertifikat terbit.
     Tanpa data ini, halaman riwayat dan verifikasi sertifikat tidak dapat
     ditinjau tanpa mengisi semuanya secara manual lebih dulu.
     --------------------------------------------------------------------- */

  const julyEnrollments = await db.enrollment.findMany({
    where: { batchId: "training-isms-july" },
    orderBy: { participantId: "asc" },
  });

  const bank = await db.question.findMany({
    where: { courseId: "course-isms", deletedAt: null },
    include: { options: { orderBy: { position: "asc" } } },
    orderBy: { id: "asc" },
  });

  const snapshotOf = (ids: string[]) =>
    bank
      .filter((q) => ids.includes(q.id))
      .map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        points: q.points,
        explanation: q.explanation,
        correctText: q.correctText,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          correct: o.correct,
        })),
      }));

  const preIds = [
    "q-isms-cia",
    "q-isms-leadership",
    "q-isms-password",
    "q-isms-incident",
    "q-isms-classification",
  ];
  const finalIds = [
    ...preIds,
    "q-isms-scope",
    "q-isms-interested",
    "q-isms-risk-owner",
    "q-isms-soa",
    "q-isms-annexa",
  ];

  const julyDays = [
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-07-02T00:00:00.000Z"),
    new Date("2026-07-03T00:00:00.000Z"),
  ];

  const lessonIds = (
    await db.lesson.findMany({
      where: { module: { courseId: "course-isms" } },
      select: { id: true },
      orderBy: { id: "asc" },
    })
  ).map((l) => l.id);

  // Nilai yang sengaja beragam: dua peserta tidak lulus ujian akhir, sehingga
  // layar kelayakan sertifikat memperlihatkan keadaan "belum terpenuhi" juga,
  // bukan hanya kasus yang mulus.
  const preScores = [67, 60, 73, 55, 80, 67, 47, 73, 60, 67];
  const finalScores = [91, 85, 78, 62, 95, 88, 55, 82, 76, 90];

  for (let index = 0; index < julyEnrollments.length; index++) {
    const enrollment = julyEnrollments[index];
    const preScore = preScores[index % preScores.length];
    const finalScore = finalScores[index % finalScores.length];

    for (const [dayIndex, day] of julyDays.entries())
      await db.attendance.upsert({
        where: { enrollmentId_date: { enrollmentId: enrollment.id, date: day } },
        create: {
          enrollmentId: enrollment.id,
          date: day,
          // Satu keterlambatan dan satu izin agar seluruh nada status terlihat.
          status:
            index === 6 && dayIndex === 2
              ? "ABSENT"
              : index === 3 && dayIndex === 1
                ? "LATE"
                : index === 8 && dayIndex === 0
                  ? "EXCUSED"
                  : "PRESENT",
          markedBy: "user-trainer",
        },
        update: {},
      });

    for (const lessonId of lessonIds)
      await db.lessonCompletion.upsert({
        where: {
          enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
        },
        create: { enrollmentId: enrollment.id, lessonId },
        update: {},
      });

    for (const [assessmentId, ids, score, submittedAt] of [
      [
        "assessment-july-pre",
        preIds,
        preScore,
        new Date("2026-07-01T09:30:00+07:00"),
      ],
      [
        "assessment-july-final",
        finalIds,
        finalScore,
        new Date("2026-07-03T15:30:00+07:00"),
      ],
    ] as [string, string[], number, Date][]) {
      const assessment = await db.assessment.findUniqueOrThrow({
        where: { id: assessmentId },
      });
      await db.assessmentAttempt.upsert({
        where: {
          assessmentId_enrollmentId_attemptNumber: {
            assessmentId,
            enrollmentId: enrollment.id,
            attemptNumber: 1,
          },
        },
        create: {
          assessmentId,
          enrollmentId: enrollment.id,
          attemptNumber: 1,
          startedAt: new Date(submittedAt.getTime() - 20 * 60 * 1000),
          expiresAt: submittedAt,
          submittedAt,
          score,
          passed: score >= assessment.passingGrade,
          questionSnapshot: snapshotOf(ids),
        },
        update: {},
      });
    }

    await db.assignmentSubmission.upsert({
      where: {
        assignmentId_enrollmentId: {
          assignmentId: "assignment-july-risk",
          enrollmentId: enrollment.id,
        },
      },
      create: {
        assignmentId: "assignment-july-risk",
        enrollmentId: enrollment.id,
        link: "https://example.com/tqi/register-risiko-contoh.xlsx",
        notes: "Register risiko unit kerja, lima risiko utama.",
        status: "COMPLETED",
        score: Math.min(100, finalScore + 5),
        feedback:
          "Identifikasi risiko sudah tepat. Lengkapi kolom pemilik risiko pada revisi berikutnya.",
        reviewedBy: "user-trainer",
        reviewedAt: new Date("2026-07-12T10:00:00+07:00"),
        submittedAt: new Date("2026-07-09T20:00:00+07:00"),
      },
      update: {},
    });

    const evaluation = await db.trainingEvaluation.findUniqueOrThrow({
      where: { batchId: "training-isms-july" },
    });
    const rating = 4 + (index % 2);
    await db.evaluationResponse.upsert({
      where: {
        evaluationId_enrollmentId: {
          evaluationId: evaluation.id,
          enrollmentId: enrollment.id,
        },
      },
      create: {
        evaluationId: evaluation.id,
        enrollmentId: enrollment.id,
        answers: {
          "content-relevance": rating,
          "content-depth": rating,
          "trainer-clarity": Math.min(5, rating + 1),
          "trainer-mastery": 5,
          "delivery-pace": rating,
          facility: 4,
          overall: Math.min(5, rating + 1),
          improvement:
            index % 3 === 0
              ? "Perbanyak studi kasus dari industri yang serupa dengan perusahaan kami."
              : "",
        },
        submittedAt: new Date("2026-07-03T16:30:00+07:00"),
      },
      update: {},
    });
  }

  /* ---------------------------------------------------------------------
     Sertifikat kelas Juli

     Diterbitkan hanya untuk peserta yang memenuhi syarat, memakai jalur
     penomoran yang sama dengan aplikasi: urutan diambil dari
     CertificateSequence, bukan dari jumlah baris sertifikat.
     --------------------------------------------------------------------- */

  const julyBatch = await db.trainingBatch.findUniqueOrThrow({
    where: { id: "training-isms-july" },
    include: {
      course: true,
      organization: true,
      trainers: { include: { trainer: true } },
    },
  });

  for (const enrollment of julyEnrollments) {
    const attempt = await db.assessmentAttempt.findFirst({
      where: {
        assessmentId: "assessment-july-final",
        enrollmentId: enrollment.id,
      },
    });
    if (!attempt?.passed) continue;
    if (await db.certificate.findUnique({ where: { enrollmentId: enrollment.id } }))
      continue;

    const participant = await db.user.findUniqueOrThrow({
      where: { id: enrollment.participantId },
    });
    const counter = await db.certificateSequence.upsert({
      where: { scope: "ISMS-2026" },
      create: { scope: "ISMS-2026", last: 1 },
      update: { last: { increment: 1 } },
    });

    await db.certificate.create({
      data: {
        number: `TQI-ISMS-2026-${String(counter.last).padStart(6, "0")}`,
        enrollmentId: enrollment.id,
        status: "ISSUED",
        issuedAt: new Date("2026-07-15T09:00:00+07:00"),
        createdBy: "user-admin",
        snapshot: {
          participant: participant.name,
          participantEmail: participant.email,
          course: julyBatch.course.title,
          courseCategory: julyBatch.course.category,
          training: julyBatch.title,
          trainingCode: julyBatch.code,
          organization: julyBatch.organization?.name ?? null,
          trainers: julyBatch.trainers.map((t) => t.trainer.name),
          startDate: "2026-07-01",
          endDate: "2026-07-03",
          durationHours: julyBatch.course.duration,
          finalScore: Math.round(attempt.score ?? 0),
          attendanceRate: 100,
        },
      },
    });
  }

  /* Kelas September sedang berjalan: sebagian materi selesai, presensi hari
     pertama tercatat, penilaian belum dikerjakan. */

  const septEnrollments = await db.enrollment.findMany({
    where: { batchId: "training-isms-sept" },
    orderBy: { participantId: "asc" },
  });

  for (const [index, enrollment] of septEnrollments.entries()) {
    await db.attendance.upsert({
      where: {
        enrollmentId_date: {
          enrollmentId: enrollment.id,
          date: new Date("2026-09-16T00:00:00.000Z"),
        },
      },
      create: {
        enrollmentId: enrollment.id,
        date: new Date("2026-09-16T00:00:00.000Z"),
        status: index === 4 ? "LATE" : "PRESENT",
        markedBy: "user-trainer",
      },
      update: {},
    });

    for (const lessonId of lessonIds.slice(0, 4 + (index % 3)))
      await db.lessonCompletion.upsert({
        where: {
          enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
        },
        create: { enrollmentId: enrollment.id, lessonId },
        update: {},
      });
  }

  const issued = await db.certificate.count({ where: { status: "ISSUED" } });
  console.log(
    `Seed selesai: 3 organisasi, 4 course, 5 training, 10 peserta, ${questions.length} soal, dan ${issued} sertifikat contoh. Seluruh data ini hanya untuk pengembangan.`,
  );
}

main().finally(() => db.$disconnect());
