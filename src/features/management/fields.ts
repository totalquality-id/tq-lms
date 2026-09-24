import type { FieldSpec } from "./entity-form";
import { labels } from "@/lib/utils";
export type Option = { id: string; name?: string; title?: string };
const options = (items: Option[], empty: string) => [
  { value: "", label: empty },
  ...items.map((x) => ({ value: x.id, label: x.name ?? x.title ?? x.id })),
];
const enums = (values: string[]) =>
  values.map((value) => ({ value, label: labels[value] ?? value }));
export function orgFields(data?: {
  name: string;
  industry: string | null;
  email: string | null;
  address: string | null;
}): FieldSpec[] {
  return [
    {
      name: "name",
      label: "Nama organisasi",
      required: true,
      full: true,
      defaultValue: data?.name,
    },
    { name: "industry", label: "Industri", defaultValue: data?.industry ?? "" },
    {
      name: "email",
      label: "Email kontak",
      type: "email",
      defaultValue: data?.email ?? "",
    },
    {
      name: "address",
      label: "Alamat",
      type: "textarea",
      full: true,
      defaultValue: data?.address ?? "",
    },
  ];
}
export function userFields(
  orgs: Option[],
  superAdmin: boolean,
  role = "PARTICIPANT",
  data?: {
    name: string;
    email: string;
    role: string;
    jobTitle: string | null;
    authId: string | null;
    memberships: { organizationId: string }[];
  },
): FieldSpec[] {
  return [
    {
      name: "name",
      label: "Nama lengkap",
      required: true,
      defaultValue: data?.name,
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      defaultValue: data?.email,
    },
    {
      name: "role",
      label: "Peran",
      required: true,
      defaultValue: data?.role ?? role,
      options: enums(
        superAdmin
          ? ["PARTICIPANT", "TRAINER", "CORPORATE_PIC", "ADMIN", "SUPER_ADMIN"]
          : ["PARTICIPANT", "TRAINER", "CORPORATE_PIC"],
      ),
    },
    {
      name: "organizationId",
      label: "Organisasi",
      defaultValue: data?.memberships[0]?.organizationId,
      options: options(orgs, "Tanpa organisasi"),
    },
    { name: "jobTitle", label: "Jabatan", defaultValue: data?.jobTitle ?? "" },
    {
      name: "authId",
      label: "ID akun Supabase Auth",
      defaultValue: data?.authId ?? "",
      help: "Tautkan ID pengguna Supabase untuk mengaktifkan login produksi.",
    },
  ];
}
export function courseFields(data?: {
  title: string;
  code: string;
  shortDescription: string;
  description: string;
  objectives: string;
  category: string;
  duration: number;
  passingGrade: number;
  published: boolean;
  sequential: boolean;
}): FieldSpec[] {
  return [
    {
      name: "title",
      label: "Judul course",
      required: true,
      full: true,
      defaultValue: data?.title,
    },
    {
      name: "shortDescription",
      label: "Ringkasan",
      type: "textarea",
      required: true,
      full: true,
      defaultValue: data?.shortDescription,
    },
    {
      name: "code",
      label: "Kode sertifikat",
      required: true,
      defaultValue: data?.code ?? "",
      placeholder: "ISMS",
      help: "Muncul pada nomor sertifikat, contoh TQI-ISMS-2026-000142.",
    },
    {
      name: "category",
      label: "Kategori",
      required: true,
      defaultValue: data?.category ?? "Information Security",
      options: [
        "Information Security",
        "Quality Management",
        "Health & Safety",
        "Environmental Management",
        "Continuous Improvement",
      ].map((value) => ({ value, label: value })),
    },
    {
      name: "duration",
      label: "Durasi (jam)",
      type: "number",
      required: true,
      defaultValue: data?.duration ?? 8,
      min: 1,
      max: 1000,
    },
    {
      name: "passingGrade",
      label: "Nilai kelulusan",
      type: "number",
      required: true,
      defaultValue: data?.passingGrade ?? 70,
      min: 0,
      max: 100,
    },
    {
      name: "published",
      label: "Status publikasi",
      defaultValue: String(data?.published ?? false),
      options: [
        { value: "false", label: "Draft" },
        { value: "true", label: "Dipublikasikan" },
      ],
    },
    {
      name: "sequential",
      label: "Alur belajar",
      defaultValue: String(data?.sequential ?? false),
      options: [
        { value: "false", label: "Bebas — peserta memilih sendiri" },
        { value: "true", label: "Berurutan — kunci sampai selesai" },
      ],
    },
    {
      name: "description",
      label: "Deskripsi lengkap",
      type: "textarea",
      full: true,
      defaultValue: data?.description,
    },
    {
      name: "objectives",
      label: "Tujuan pembelajaran",
      type: "textarea",
      full: true,
      defaultValue: data?.objectives,
    },
  ];
}
type BatchValues = {
  title: string;
  courseId: string;
  organizationId: string | null;
  mode: string;
  status: string;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  venue: string | null;
  meetingUrl: string | null;
  capacity: number;
  description: string;
};
export function batchFields(
  courses: Option[],
  orgs: Option[],
  trainers: Option[],
  data?: BatchValues,
): FieldSpec[] {
  const day = (d?: Date) =>
    d
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(d)
      : "";
  return [
    {
      name: "title",
      label: "Nama training",
      required: true,
      full: true,
      defaultValue: data?.title,
    },
    {
      name: "courseId",
      label: data ? "Course training" : "Course yang disalin",
      required: true,
      help: data
        ? "Pilih course induk lain hanya sebelum ada peserta atau penilaian. Materi dan soal akan disalin ulang."
        : "Materi dan bank soal disalin ke training ini, lalu dapat diedit secara terpisah.",
      options: options(courses, "Pilih course"),
      defaultValue: data?.courseId,
    },
    {
      name: "organizationId",
      label: "Organisasi",
      options: options(orgs, "Training umum"),
      defaultValue: data?.organizationId ?? "",
    },
    {
      name: "startDate",
      label: "Tanggal mulai",
      type: "date",
      required: true,
      defaultValue: day(data?.startDate),
    },
    {
      name: "endDate",
      label: "Tanggal selesai",
      type: "date",
      required: true,
      defaultValue: day(data?.endDate),
    },
    {
      name: "startTime",
      label: "Jam mulai (WIB)",
      type: "time",
      required: true,
      defaultValue: data?.startTime ?? "09:00",
    },
    {
      name: "endTime",
      label: "Jam selesai (WIB)",
      type: "time",
      required: true,
      defaultValue: data?.endTime ?? "16:00",
    },
    {
      name: "mode",
      label: "Metode",
      options: enums(["OFFLINE", "ONLINE", "HYBRID"]),
      defaultValue: data?.mode ?? "OFFLINE",
    },
    {
      name: "capacity",
      label: "Kapasitas peserta",
      type: "number",
      required: true,
      min: 1,
      max: 1000,
      defaultValue: data?.capacity ?? 30,
    },
    { name: "venue", label: "Lokasi", defaultValue: data?.venue ?? "" },
    {
      name: "meetingUrl",
      label: "Tautan pertemuan",
      type: "url",
      defaultValue: data?.meetingUrl ?? "",
    },
    {
      name: "status",
      label: "Status training",
      options: enums(["DRAFT", "OPEN", "ONGOING", "CANCELLED"]),
      defaultValue: data?.status ?? "DRAFT",
    },
    {
      name: "trainerId",
      label: "Tambahkan trainer",
      options: options(trainers, "Pilih trainer (opsional)"),
    },
    {
      name: "description",
      label: "Deskripsi",
      type: "textarea",
      full: true,
      defaultValue: data?.description,
    },
  ];
}
export function lessonFields(data?: {
  title: string;
  type: string;
  content: string;
  resourceUrl: string | null;
  duration: number;
}): FieldSpec[] {
  return [
    {
      name: "title",
      label: "Judul pelajaran",
      required: true,
      full: true,
      defaultValue: data?.title,
    },
    {
      name: "type",
      label: "Jenis materi",
      options: enums([
        "TEXT",
        "PDF",
        "VIDEO",
        "IMAGE",
        "FILE",
        "EXTERNAL_LINK",
      ]),
      defaultValue: data?.type ?? "TEXT",
    },
    {
      name: "duration",
      label: "Durasi (menit)",
      type: "number",
      required: true,
      defaultValue: data?.duration ?? 15,
      min: 1,
      max: 600,
    },
    {
      name: "content",
      label: "Isi artikel / deskripsi",
      type: "textarea",
      full: true,
      defaultValue: data?.content,
    },
    {
      name: "resourceUrl",
      label: "Tautan materi",
      type: "url",
      full: true,
      defaultValue: data?.resourceUrl ?? "",
      help: "Tautan HTTPS ke PDF, video, gambar, atau berkas. Akses tautan mengikuti pengaturan penyedianya.",
    },
  ];
}
