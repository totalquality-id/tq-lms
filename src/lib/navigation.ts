import type { UserRole } from "@prisma/client";

import { isAdmin } from "./policy";

export type NavItem = { href: string; label: string };
export type NavGroup = { caption?: string; items: NavItem[] };

/**
 * Navigasi berbasis teks. Ikon sengaja tidak dipakai di sini: label pendek
 * sudah cukup untuk dikenali, dan satu ikon di samping setiap baris hanya
 * menambah keramaian tanpa menambah arti.
 *
 * Daftar ini hanya mengatur apa yang terlihat. Wewenang sesungguhnya tetap
 * diperiksa ulang di server pada setiap halaman dan setiap mutasi.
 */
export function navigationFor(role: UserRole): NavGroup[] {
  if (isAdmin(role))
    return [
      { items: [{ href: "/admin", label: "Dashboard" }] },
      {
        caption: "Pelatihan",
        items: [
          { href: "/admin/courses", label: "Course" },
          { href: "/admin/training", label: "Training" },
          { href: "/admin/participants", label: "Peserta" },
          { href: "/admin/trainers", label: "Trainer" },
          { href: "/admin/organizations", label: "Organisasi" },
        ],
      },
      {
        caption: "Pembelajaran",
        items: [
          { href: "/admin/question-bank", label: "Bank soal" },
          { href: "/admin/evaluations", label: "Evaluasi" },
        ],
      },
      {
        caption: "Sertifikasi",
        items: [{ href: "/admin/certificates", label: "Sertifikat" }],
      },
      {
        caption: "Laporan",
        items: [{ href: "/admin/reports", label: "Laporan" }],
      },
      {
        caption: "Administrasi",
        items: [
          { href: "/admin/users", label: "Pengguna" },
          { href: "/profile", label: "Profil saya" },
        ],
      },
    ];

  if (role === "TRAINER")
    return [
      {
        items: [
          { href: "/trainer", label: "Dashboard" },
          { href: "/trainer/training", label: "Training saya" },
          { href: "/trainer/reviews", label: "Penilaian" },
          { href: "/profile", label: "Profil saya" },
        ],
      },
    ];

  if (role === "CORPORATE_PIC")
    return [
      {
        items: [
          { href: "/organization", label: "Dashboard" },
          { href: "/organization/training", label: "Training perusahaan" },
          { href: "/organization/employees", label: "Karyawan" },
          { href: "/organization/certificates", label: "Sertifikat" },
          { href: "/profile", label: "Profil saya" },
        ],
      },
    ];

  return [
    {
      items: [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/my-training", label: "Training saya" },
        { href: "/certificates", label: "Sertifikat" },
        { href: "/history", label: "Riwayat pelatihan" },
        { href: "/profile", label: "Profil saya" },
      ],
    },
  ];
}
