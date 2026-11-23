import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Amiri } from "next/font/google";
import "./globals.css";

// خط الواجهة والعناوين — يُحمّلان فعليًا (لا يكفي ذكرهما في CSS دون تحميل)
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });
const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-amiri", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ليلتنا | LAYLATNA — تخطيط المناسبات وإدارة الدعوات", template: "%s | ليلتنا LAYLATNA" },
  description: "منصة عربية شاملة لتخطيط المناسبات وتنظيمها: ميزانية ومصروفات ومهام وموردون وجدول زمني، مع دعوات متحركة وتأكيد حضور وبطاقات QR وتقارير.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4A3B36",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${amiri.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
