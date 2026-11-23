import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ws يُحمَّل في وقت التشغيل لتجنب تعارض الحزمة الأصلية مع حزم Next
  serverExternalPackages: ["ws"],
  // صفحات الضيوف خاصة: منع أي كاش عام
  async headers() {
    return [
      {
        source: "/i/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  experimental: {
    // رفع الوسائط عبر route handlers (حدود الحجم تُفحص داخل الخدمة)
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
