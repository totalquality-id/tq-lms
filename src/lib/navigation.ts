import type { UserRole } from "@prisma/client";

import { isAdmin } from "./policy";

/**
 * Nama ikon, bukan komponennya: definisi ini dibaca di server lalu dikirim ke
 * komponen navigasi di klien, dan komponen React tidak dapat melintasi batas
 * itu. Pemetaan nama ke ikon dilakukan di sisi klien.
 */
export type NavIcon =
  | "dashboard"
  | "course"
  | "training"
  | "participants"
  | "trainer"
  | "organization"
  | "question"
  | "evaluation"
  | "certificate"
  | "report"
  | "users"
  | "profile"
  | "review"
  | "history";

export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavGroup = { caption?: string; items: NavItem[] };

export type Workspace = { name: string; caption: string };

/** Judul ruang kerja pada kepala sidebar, mengikuti peran pembaca. */
export function workspaceFor(role: UserRole): Workspace {
  if (isAdmin(role))
    return { name: "Administrasi", caption: "Pusat pengelolaan pelatihan" };
  if (role === "TRAINER")
    return { name: "Trainer", caption: "Kelas yang Anda ampu" };
  if (role === "CORPORATE_PIC")
    return { name: "Perusahaan", caption: "Pelatihan karyawan Anda" };
  return { name: "Belajar", caption: "Perjalanan pelatihan Anda" };
}

/**
 * Daftar ini hanya mengatur apa yang terlihat. Wewenang sesungguhnya tetap
 * diperiksa ulang di server pada setiap halaman dan setiap mutasi.
 */
export function navigationFor(role: UserRole): NavGroup[] {
  if (isAdmin(role))
    return [
      { items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }] },
      {
        caption: "Pelatihan",
        items: [
          { href: "/admin/courses", label: "Course", icon: "course" },
          { href: "/admin/training", label: "Training", icon: "training" },
          {
            href: "/admin/participants",
            label: "Peserta",
            icon: "participants",
          },
          { href: "/admin/trainers", label: "Trainer", icon: "trainer" },
          {
            href: "/admin/organizations",
            label: "Organisasi",
            icon: "organization",
          },
        ],
      },
      {
        caption: "Pembelajaran",
        items: [
          {
            href: "/admin/question-bank",
            label: "Bank soal",
            icon: "question",
          },
          {
            href: "/admin/evaluations",
            label: "Evaluasi",
            icon: "evaluation",
          },
        ],
      },
      {
        caption: "Sertifikasi & laporan",
        items: [
          {
            href: "/admin/certificates",
            label: "Sertifikat",
            icon: "certificate",
          },
          { href: "/admin/reports", label: "Laporan", icon: "report" },
        ],
      },
      {
        caption: "Administrasi",
        items: [
          { href: "/admin/users", label: "Pengguna", icon: "users" },
          { href: "/profile", label: "Profil saya", icon: "profile" },
        ],
      },
    ];

  if (role === "TRAINER")
    return [
      {
        items: [
          { href: "/trainer", label: "Dashboard", icon: "dashboard" },
          {
            href: "/trainer/training",
            label: "Training saya",
            icon: "training",
          },
          { href: "/trainer/reviews", label: "Penilaian", icon: "review" },
          { href: "/profile", label: "Profil saya", icon: "profile" },
        ],
      },
    ];

  if (role === "CORPORATE_PIC")
    return [
      {
        items: [
          { href: "/organization", label: "Dashboard", icon: "dashboard" },
          {
            href: "/organization/training",
            label: "Training perusahaan",
            icon: "training",
          },
          {
            href: "/organization/employees",
            label: "Karyawan",
            icon: "participants",
          },
          {
            href: "/organization/certificates",
            label: "Sertifikat",
            icon: "certificate",
          },
          { href: "/profile", label: "Profil saya", icon: "profile" },
        ],
      },
    ];

  return [
    {
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/my-training", label: "Training saya", icon: "training" },
        { href: "/certificates", label: "Sertifikat", icon: "certificate" },
        { href: "/history", label: "Riwayat pelatihan", icon: "history" },
        { href: "/profile", label: "Profil saya", icon: "profile" },
      ],
    },
  ];
}
