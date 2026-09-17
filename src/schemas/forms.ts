import { z } from "zod";
import {
  LessonType,
  TrainingMode,
  TrainingStatus,
  UserRole,
} from "@prisma/client";
const text = z.string().trim().min(2, "Isi minimal 2 karakter.").max(200);
const optional = z.string().trim().max(2000).optional().default("");
const url = z
  .union([
    z.literal(""),
    z
      .url()
      .refine((v) => /^https?:\/\//.test(v), "Gunakan URL HTTP atau HTTPS."),
  ])
  .optional()
  .default("");
export const organizationSchema = z.object({
  name: text,
  industry: optional,
  email: z
    .union([z.literal(""), z.email()])
    .optional()
    .default(""),
  address: optional,
});
export const userSchema = z
  .object({
    name: text,
    email: z.email().transform((s) => s.toLowerCase()),
    role: z.enum(UserRole),
    organizationId: optional,
    jobTitle: optional,
    authId: z
      .union([z.literal(""), z.uuid()])
      .optional()
      .default(""),
  })
  .refine((v) => v.role !== "CORPORATE_PIC" || !!v.organizationId, {
    path: ["organizationId"],
    message: "Pilih organisasi untuk PIC.",
  });
export const courseSchema = z.object({
  title: text,
  // Kode singkat yang muncul pada nomor sertifikat, misalnya ISMS pada
  // TQI-ISMS-2026-000142. Dibatasi huruf dan angka agar nomornya tetap aman
  // dipakai di URL verifikasi dan nama berkas.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Gunakan 2–10 huruf atau angka tanpa spasi."),
  shortDescription: z
    .string()
    .trim()
    .min(10, "Tuliskan ringkasan minimal 10 karakter.")
    .max(500),
  description: optional,
  objectives: optional,
  category: text,
  duration: z.coerce.number().int().min(1).max(1000),
  passingGrade: z.coerce.number().int().min(0).max(100),
  published: z.enum(["true", "false"]).transform((v) => v === "true"),
  sequential: z.enum(["true", "false"]).transform((v) => v === "true"),
});
export const batchSchema = z
  .object({
    title: text,
    courseId: text,
    organizationId: optional,
    mode: z.enum(TrainingMode),
    status: z.enum(TrainingStatus),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    venue: optional,
    meetingUrl: url,
    capacity: z.coerce.number().int().min(1).max(1000),
    trainerId: optional,
    description: optional,
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
  })
  .refine((v) => v.endTime > v.startTime, {
    path: ["endTime"],
    message: "Jam selesai harus setelah jam mulai.",
  })
  .refine((v) => v.mode === "OFFLINE" || !!v.meetingUrl, {
    path: ["meetingUrl"],
    message: "Isi tautan pertemuan untuk kelas online/hybrid.",
  });
export const lessonSchema = z
  .object({
    title: text,
    type: z.enum(LessonType),
    content: z.string().max(50000).default(""),
    resourceUrl: url,
    duration: z.coerce.number().int().min(1).max(600),
  })
  .refine(
    (v) => (v.type === "TEXT" ? v.content.trim().length > 0 : !!v.resourceUrl),
    {
      path: ["content"],
      message: "Isi artikel atau tautan materi yang sesuai.",
    },
  );
export type FormState = {
  success?: string;
  error?: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
};
