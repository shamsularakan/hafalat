import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ليلتنا | LAYLATNA — تخطيط المناسبات وإدارة الدعوات", template: "%s | ليلتنا LAYLATNA" },
  description: "منصة عربية شاملة لتخطيط المناسبات وتنظيمها: ميزانية ومصروفات ومهام وموردون وجدول زمني، مع دعوات متحركة وتأكيد حضور وبطاقات QR وتقارير.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111827",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
