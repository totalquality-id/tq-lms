import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

/**
 * Plus Jakarta Sans pada tiga berat saja: 400 untuk teks, 500 untuk penekanan
 * ringan, 600 untuk judul.
 *
 * Berat 700 sengaja tidak dimuat. Tangga 400 ke 700 terlalu jauh — judulnya
 * memukul, teksnya jadi terlihat pucat, dan halaman terbaca belang. Dengan 700
 * tidak tersedia, `font-semibold` yang tanpa sengaja terpakai pun akan jatuh ke
 * berat terdekat, bukan melompat.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: "TQ Learning", template: "%s · TQ Learning" },
  description:
    "Platform pelatihan dan pengembangan kompetensi PT Total Quality Indonesia",
  applicationName: "TQ Learning",
  icons: { icon: "/tq-logo.webp" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
