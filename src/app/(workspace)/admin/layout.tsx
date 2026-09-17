import { requireRole } from "@/services/access";

/**
 * Penjaga di tingkat segmen: satu pemeriksaan di sini berlaku untuk seluruh
 * halaman admin, sehingga menambah halaman baru tidak dapat lupa memasangnya.
 * Setiap layanan tetap memeriksa ulang wewenangnya sendiri.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("ADMIN", "SUPER_ADMIN");
  return children;
}
