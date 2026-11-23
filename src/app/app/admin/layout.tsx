import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/context";

/** حاجز صفحة مدير المنصة — التحقق في الخادم قبل أي رسم */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || user.is_platform_admin !== 1) redirect("/app");
  return <>{children}</>;
}
